"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { logActivity } from "@/lib/audit/log-activity";
import { db } from "@/lib/db";
import { appointmentsTable, consultationPaymentsTable } from "@/lib/db/schema";
import { parseMarkPaidForm, parsePaymentForm } from "@/lib/validators/payment";

export async function upsertConsultationPayment(_prev: unknown, formData: FormData) {
  const session = await getActionSession("payments:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parsePaymentForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const [appointment] = await db
    .select({ patientId: appointmentsTable.patientId })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, data.appointmentId));

  if (!appointment) return actionError("Cita no encontrada");

  const amountCents = Math.round(data.amount * 100);
  const paidAt = data.status === "paid" ? new Date() : null;

  const [existing] = await db
    .select()
    .from(consultationPaymentsTable)
    .where(eq(consultationPaymentsTable.appointmentId, data.appointmentId));

  let paymentId: number;

  if (existing) {
    await db
      .update(consultationPaymentsTable)
      .set({
        amountCents,
        method: data.method,
        status: data.status,
        reference: data.reference,
        notes: data.notes,
        paidAt: paidAt ?? existing.paidAt,
        recordedById: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(consultationPaymentsTable.id, existing.id));
    paymentId = existing.id;
  } else {
    const [created] = await db
      .insert(consultationPaymentsTable)
      .values({
        appointmentId: data.appointmentId,
        patientId: appointment.patientId,
        amountCents,
        method: data.method,
        status: data.status,
        reference: data.reference,
        notes: data.notes,
        paidAt,
        recordedById: session.userId,
      })
      .returning({ id: consultationPaymentsTable.id });
    paymentId = created.id;
  }

  await logActivity({
    userId: session.userId,
    module: "pagos",
    action: data.status === "paid" ? "pagar" : "registrar",
    recordId: paymentId,
    detail: `Cita #${data.appointmentId}`,
  });

  revalidatePath(`/agenda/${data.appointmentId}`);
  revalidatePath("/pagos");
  revalidatePath("/portal/citas");
  return actionSuccess({ paymentId });
}

export async function markPaymentPaid(_prev: unknown, formData: FormData) {
  const session = await getActionSession("payments:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseMarkPaidForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const [payment] = await db
    .select()
    .from(consultationPaymentsTable)
    .where(eq(consultationPaymentsTable.id, data.paymentId));

  if (!payment) return actionError("Pago no encontrado");

  await db
    .update(consultationPaymentsTable)
    .set({
      status: "paid",
      method: data.method,
      reference: data.reference,
      paidAt: new Date(),
      recordedById: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(consultationPaymentsTable.id, data.paymentId));

  await logActivity({
    userId: session.userId,
    module: "pagos",
    action: "pagar",
    recordId: data.paymentId,
    detail: `Cita #${payment.appointmentId}`,
  });

  revalidatePath(`/agenda/${payment.appointmentId}`);
  revalidatePath("/pagos");
  revalidatePath("/portal/citas");
  return actionSuccess({ paymentId: data.paymentId });
}
