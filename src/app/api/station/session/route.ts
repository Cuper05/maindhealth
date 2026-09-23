import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  patientsTable,
  stationKioskSessionsTable,
  stationPaymentOrdersTable,
  type KioskStep,
} from "@/lib/db/schema";
import { getKioskAppointmentContext } from "@/lib/queries/kiosk";
import { getKioskCookie, newKioskToken } from "@/lib/kiosk/session-cookie";
import { publicVitalsDraft } from "@/lib/kiosk/kardia";
import { stationDbErrorResponse } from "@/lib/db/errors";

function publicPaymentOrder(order: {
  id: number;
  reference: string;
  amountCents: number;
  currency: string;
  concept: string;
  status: string;
  provider: string;
  approvedAt: Date | null;
  providerReference: string | null;
  providerPayload: unknown;
  serviceId: number;
}) {
  const payload =
    order.providerPayload && typeof order.providerPayload === "object"
      ? (order.providerPayload as Record<string, unknown>)
      : {};
  return {
    id: order.id,
    reference: order.reference,
    amountCents: order.amountCents,
    currency: order.currency,
    concept: order.concept,
    status: order.status,
    provider: order.provider,
    approvedAt: order.approvedAt,
    providerReference: order.providerReference,
    serviceId: order.serviceId,
    stripeCheckoutSessionId:
      typeof payload.stripeCheckoutSessionId === "string" ? payload.stripeCheckoutSessionId : null,
    stripeCheckoutUrl: typeof payload.stripeCheckoutUrl === "string" ? payload.stripeCheckoutUrl : null,
  };
}

async function loadSession(token: string) {
  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, token));
  if (!session) return null;

  let patient = null;
  if (session.patientId) {
    const [row] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, session.patientId));
    if (row) {
      patient = {
        id: row.id,
        chartNumber: row.chartNumber,
        name: [row.firstName, row.lastNamePaternal, row.lastNameMaternal].filter(Boolean).join(" "),
        birthDate: row.birthDate,
        sex: row.sex,
        phone: row.phone,
        email: row.email,
        hasKioskLogin: Boolean(row.kioskUsername && row.kioskPasswordHash),
      };
    }
  }

  const appointment = session.appointmentId
    ? await getKioskAppointmentContext(session.appointmentId)
    : null;

  let paymentOrder = null;
  if (session.paymentOrderId) {
    const [order] = await db
      .select({
        id: stationPaymentOrdersTable.id,
        reference: stationPaymentOrdersTable.reference,
        amountCents: stationPaymentOrdersTable.amountCents,
        currency: stationPaymentOrdersTable.currency,
        concept: stationPaymentOrdersTable.concept,
        status: stationPaymentOrdersTable.status,
        provider: stationPaymentOrdersTable.provider,
        approvedAt: stationPaymentOrdersTable.approvedAt,
        providerReference: stationPaymentOrdersTable.providerReference,
        providerPayload: stationPaymentOrdersTable.providerPayload,
        serviceId: stationPaymentOrdersTable.serviceId,
      })
      .from(stationPaymentOrdersTable)
      .where(eq(stationPaymentOrdersTable.id, session.paymentOrderId));
    paymentOrder = order ? publicPaymentOrder(order) : null;
  }

  return { session, patient, appointment, paymentOrder };
}

export async function GET() {
  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ session: null });
  }
  const data = await loadSession(cookie.token);
  if (!data) {
    cookie.token = undefined;
    await cookie.save();
    return NextResponse.json({ session: null });
  }

  const sealed =
    data.session.status === "completed" ||
    data.session.status === "abandoned" ||
    data.session.currentStep === "welcome";

  if (sealed) {
    return NextResponse.json({
      session: {
        token: data.session.token,
        currentStep: "welcome",
        patientType: null,
        patientId: null,
        appointmentId: null,
        serviceId: null,
        paymentOrderId: null,
        paymentStatus: "unpaid",
        deviceStatus: "idle",
        vitalsDraft: {},
        clinicalDraft: {},
        assessmentDraft: null,
        vitalSignId: null,
        status: data.session.status,
      },
      patient: null,
      appointment: null,
      paymentOrder: null,
    });
  }

  return NextResponse.json({
    session: {
      token: data.session.token,
      currentStep: data.session.currentStep,
      patientType: data.session.patientType,
      patientId: data.session.patientId,
      appointmentId: data.session.appointmentId,
      serviceId: data.session.serviceId,
      paymentOrderId: data.session.paymentOrderId,
      paymentStatus: data.session.paymentStatus,
      deviceStatus: data.session.deviceStatus,
      vitalsDraft: publicVitalsDraft(data.session.vitalsDraft),
      clinicalDraft: data.session.clinicalDraft ?? {},
      assessmentDraft: data.session.assessmentDraft ?? null,
      vitalSignId: data.session.vitalSignId,
      status: data.session.status,
    },
    patient: data.patient,
    appointment: data.appointment,
    paymentOrder: data.paymentOrder,
  });
}

export async function POST() {
  try {
    const cookie = await getKioskCookie();
    const token = newKioskToken();
    const [session] = await db
      .insert(stationKioskSessionsTable)
      .values({ token, currentStep: "welcome", status: "active" })
      .returning();
    cookie.token = token;
    await cookie.save();
    return NextResponse.json({ session: { token: session.token, currentStep: session.currentStep } });
  } catch (error) {
    return stationDbErrorResponse(error, "No se pudo iniciar la sesión del kiosco");
  }
}

export async function PATCH(request: Request) {
  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión de kiosco" }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.currentStep) updates.currentStep = body.currentStep as KioskStep;
  if (body.patientId !== undefined) updates.patientId = body.patientId;
  if (body.appointmentId !== undefined) updates.appointmentId = body.appointmentId;
  if (body.serviceId !== undefined) updates.serviceId = body.serviceId;
  if (body.paymentOrderId !== undefined) updates.paymentOrderId = body.paymentOrderId;
  if (body.paymentStatus !== undefined) updates.paymentStatus = body.paymentStatus;
  if (body.patientType !== undefined) updates.patientType = body.patientType;
  if (body.deviceStatus !== undefined) updates.deviceStatus = body.deviceStatus;
  if (body.vitalsDraft !== undefined) updates.vitalsDraft = body.vitalsDraft;
  if (body.clinicalDraft !== undefined) updates.clinicalDraft = body.clinicalDraft;
  if (body.assessmentDraft !== undefined) updates.assessmentDraft = body.assessmentDraft;
  if (body.vitalSignId !== undefined) updates.vitalSignId = body.vitalSignId;
  if (body.status !== undefined) updates.status = body.status;

  const [session] = await db
    .update(stationKioskSessionsTable)
    .set(updates)
    .where(eq(stationKioskSessionsTable.token, cookie.token))
    .returning();

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  // Al vincular paciente/cita tras el pago, copiar cobro al expediente (/pagos).
  if (
    session.paymentStatus === "approved" &&
    session.patientId &&
    session.appointmentId &&
    session.paymentOrderId &&
    (body.patientId !== undefined || body.appointmentId !== undefined)
  ) {
    const { syncStationPaymentToExpediente } = await import(
      "@/lib/kiosk/sync-payment-to-expediente"
    );
    await syncStationPaymentToExpediente({
      sessionToken: cookie.token,
      patientId: session.patientId,
      appointmentId: session.appointmentId,
      paymentOrderId: session.paymentOrderId,
    });
  }

  return NextResponse.json({ ok: true, session });
}

export async function DELETE() {
  const cookie = await getKioskCookie();
  if (cookie.token) {
    const [row] = await db
      .select({
        id: stationKioskSessionsTable.id,
        status: stationKioskSessionsTable.status,
      })
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.token, cookie.token));

    // A new kiosk visit must not kill a patient already waiting for the doctor.
    if (row && row.status !== "waiting_doctor") {
      await db
        .update(stationKioskSessionsTable)
        .set({ status: "abandoned", updatedAt: new Date() })
        .where(eq(stationKioskSessionsTable.id, row.id));
    }
  }
  cookie.token = undefined;
  await cookie.save();
  return NextResponse.json({ ok: true });
}
