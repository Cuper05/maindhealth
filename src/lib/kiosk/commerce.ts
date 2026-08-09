import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  stationClinicalProtocolsTable,
  stationPaymentOrdersTable,
  stationResponsiblePhysiciansTable,
  stationServicesTable,
  stationKioskSessionsTable,
  usersTable,
  type ProtocolMedication,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { createHash, randomBytes } from "crypto";

const STATION_CODE = process.env.STATION_CODE ?? "EST-001";

export async function listActiveStationServices() {
  return db
    .select()
    .from(stationServicesTable)
    .where(eq(stationServicesTable.active, true))
    .orderBy(stationServicesTable.sortOrder, stationServicesTable.id);
}

export async function getActiveResponsiblePhysician() {
  const [row] = await db
    .select({
      id: stationResponsiblePhysiciansTable.id,
      doctorId: stationResponsiblePhysiciansTable.doctorId,
      authorizationNote: stationResponsiblePhysiciansTable.authorizationNote,
      firstName: usersTable.firstName,
      lastNamePaternal: usersTable.lastNamePaternal,
      lastNameMaternal: usersTable.lastNameMaternal,
      professionalLicense: usersTable.professionalLicense,
      specialty: usersTable.specialty,
    })
    .from(stationResponsiblePhysiciansTable)
    .innerJoin(usersTable, eq(stationResponsiblePhysiciansTable.doctorId, usersTable.id))
    .where(
      and(
        eq(stationResponsiblePhysiciansTable.active, true),
        eq(usersTable.active, true),
      ),
    )
    .orderBy(desc(stationResponsiblePhysiciansTable.authorizedAt))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    doctorId: row.doctorId,
    authorizationNote: row.authorizationNote,
    name: formatPersonName(row),
    professionalLicense: row.professionalLicense,
    specialty: row.specialty,
  };
}

export async function listActiveProtocols() {
  return db
    .select()
    .from(stationClinicalProtocolsTable)
    .where(eq(stationClinicalProtocolsTable.active, true));
}

function buildPaymentReference(seq: number) {
  const day = new Date();
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${STATION_CODE}-${y}${m}${d}-${String(seq).padStart(6, "0")}`;
}

export async function createStationPaymentOrder(input: {
  sessionToken: string;
  serviceId: number;
}) {
  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, input.sessionToken));
  if (!session) return { ok: false as const, error: "Sesión no encontrada" };

  const [service] = await db
    .select()
    .from(stationServicesTable)
    .where(
      and(eq(stationServicesTable.id, input.serviceId), eq(stationServicesTable.active, true)),
    );
  if (!service) return { ok: false as const, error: "Servicio no disponible" };

  // Reutilizar orden pendiente de la misma sesión/servicio (idempotencia operativa)
  if (session.paymentOrderId) {
    const [existing] = await db
      .select()
      .from(stationPaymentOrdersTable)
      .where(eq(stationPaymentOrdersTable.id, session.paymentOrderId));
    if (existing && existing.status === "pending" && existing.serviceId === service.id) {
      return { ok: true as const, order: existing, service, reused: true };
    }
    if (existing && existing.status === "approved") {
      return { ok: true as const, order: existing, service, reused: true };
    }
  }

  const recent = await db
    .select({ id: stationPaymentOrdersTable.id })
    .from(stationPaymentOrdersTable)
    .orderBy(desc(stationPaymentOrdersTable.id))
    .limit(1);
  const seq = (recent[0]?.id ?? 0) + 1;
  const reference = buildPaymentReference(seq);
  const idempotencyKey = createHash("sha256")
    .update(`${session.token}:${service.id}:${reference}`)
    .digest("hex")
    .slice(0, 48);

  const [order] = await db
    .insert(stationPaymentOrdersTable)
    .values({
      reference,
      idempotencyKey,
      stationCode: STATION_CODE,
      serviceId: service.id,
      sessionId: session.id,
      amountCents: service.amountCents,
      currency: service.currency,
      concept: service.name,
      provider: "demo", // Nayax real en fase hardware; demo = simulación terminal
      status: "pending",
    })
    .returning();

  await db
    .update(stationKioskSessionsTable)
    .set({
      serviceId: service.id,
      paymentOrderId: order.id,
      paymentStatus: "pending",
      currentStep: "payment",
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, input.sessionToken));

  return { ok: true as const, order, service, reused: false };
}

export async function confirmStationPayment(input: {
  sessionToken: string;
  paymentOrderId: number;
  status: "approved" | "rejected" | "cancelled" | "error";
  provider?: "nayax" | "stripe" | "demo";
  providerReference?: string;
  providerPayload?: Record<string, unknown>;
}) {
  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, input.sessionToken));
  if (!session) return { ok: false as const, error: "Sesión no encontrada" };

  const [order] = await db
    .select()
    .from(stationPaymentOrdersTable)
    .where(eq(stationPaymentOrdersTable.id, input.paymentOrderId));
  if (!order) return { ok: false as const, error: "Orden de pago no encontrada" };
  if (order.sessionId && order.sessionId !== session.id) {
    return { ok: false as const, error: "La orden no pertenece a esta sesión" };
  }

  if (order.status === "approved") {
    return { ok: true as const, order, alreadyApproved: true };
  }

  const [updated] = await db
    .update(stationPaymentOrdersTable)
    .set({
      status: input.status,
      provider: input.provider ?? order.provider,
      providerReference: input.providerReference ?? order.providerReference,
      providerPayload: input.providerPayload ?? order.providerPayload,
      approvedAt: input.status === "approved" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(stationPaymentOrdersTable.id, order.id))
    .returning();

  await db
    .update(stationKioskSessionsTable)
    .set({
      paymentOrderId: updated.id,
      paymentStatus: input.status,
      currentStep: input.status === "approved" ? "identification" : "payment",
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, input.sessionToken));

  return { ok: true as const, order: updated, alreadyApproved: false };
}

export function matchProtocolByComplaint(
  complaint: string,
  protocols: Array<{
    code: string;
    name: string;
    keywords: string[] | null;
    medications: ProtocolMedication[] | null;
    treatmentPlan: string | null;
    instructions: string | null;
    diagnosisLabel: string | null;
  }>,
) {
  const text = complaint.trim().toLowerCase();
  for (const protocol of protocols) {
    const keywords = protocol.keywords ?? [];
    if (keywords.some((k) => text.includes(k.toLowerCase()))) {
      return protocol;
    }
  }
  return null;
}

export function newDemoProviderReference() {
  return `NAYAX-DEMO-${randomBytes(4).toString("hex").toUpperCase()}`;
}
