import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  consultationPaymentsTable,
  stationKioskSessionsTable,
  stationPaymentOrdersTable,
} from "@/lib/db/schema";

/**
 * Copia un pago de estación aprobado a consultation_payments
 * para que aparezca en /pagos y en el expediente del paciente.
 */
export async function syncStationPaymentToExpediente(input: {
  sessionToken?: string;
  sessionId?: number;
  patientId?: number | null;
  appointmentId?: number | null;
  paymentOrderId?: number | null;
}) {
  let patientId = input.patientId ?? null;
  let appointmentId = input.appointmentId ?? null;
  let paymentOrderId = input.paymentOrderId ?? null;

  if (input.sessionToken || input.sessionId) {
    const [session] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(
        input.sessionToken
          ? eq(stationKioskSessionsTable.token, input.sessionToken)
          : eq(stationKioskSessionsTable.id, input.sessionId!),
      );
    if (!session) return { ok: false as const, reason: "session_missing" as const };
    patientId = patientId ?? session.patientId;
    appointmentId = appointmentId ?? session.appointmentId;
    paymentOrderId = paymentOrderId ?? session.paymentOrderId;
    if (session.paymentStatus !== "approved") {
      return { ok: false as const, reason: "payment_not_approved" as const };
    }
  }

  if (!patientId || !appointmentId || !paymentOrderId) {
    return { ok: false as const, reason: "missing_links" as const };
  }

  const [order] = await db
    .select()
    .from(stationPaymentOrdersTable)
    .where(eq(stationPaymentOrdersTable.id, paymentOrderId));

  if (!order || order.status !== "approved") {
    return { ok: false as const, reason: "order_not_approved" as const };
  }

  const reference = `kiosk:${order.reference}`;
  const [existing] = await db
    .select({ id: consultationPaymentsTable.id })
    .from(consultationPaymentsTable)
    .where(
      and(
        eq(consultationPaymentsTable.appointmentId, appointmentId),
        eq(consultationPaymentsTable.reference, reference),
      ),
    );

  if (existing) {
    return { ok: true as const, paymentId: existing.id, created: false };
  }

  const method =
    order.provider === "stripe"
      ? "stripe"
      : order.provider === "nayax"
        ? "card"
        : "card";

  const [row] = await db
    .insert(consultationPaymentsTable)
    .values({
      appointmentId,
      patientId,
      amountCents: order.amountCents,
      currency: order.currency || "MXN",
      method,
      status: "paid",
      reference,
      paidAt: order.approvedAt ?? new Date(),
      notes: `Pago estación · ${order.concept ?? "consulta"}${
        order.providerReference ? ` · ref ${order.providerReference}` : ""
      }`,
      updatedAt: new Date(),
    })
    .returning({ id: consultationPaymentsTable.id });

  return { ok: true as const, paymentId: row.id, created: true };
}
