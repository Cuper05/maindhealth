"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import {
  consultationsTable,
  prescriptionItemsTable,
  prescriptionsTable,
} from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { parsePrescriptionPayload } from "@/lib/validators/consultation";

export async function savePrescription(payload: unknown) {
  const session = await getActionSession("prescriptions:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parsePrescriptionPayload(payload);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const [consultation] = await db
    .select()
    .from(consultationsTable)
    .where(eq(consultationsTable.id, data.consultationId));

  if (!consultation) return actionError("Consulta no encontrada");

  const doctorId =
    session.role === "doctor" ? session.userId : consultation.doctorId;

  const [existing] = await db
    .select()
    .from(prescriptionsTable)
    .where(eq(prescriptionsTable.consultationId, data.consultationId));

  let prescriptionId: number;

  if (existing) {
    await db
      .update(prescriptionsTable)
      .set({ generalNotes: data.generalNotes })
      .where(eq(prescriptionsTable.id, existing.id));
    await db
      .delete(prescriptionItemsTable)
      .where(eq(prescriptionItemsTable.prescriptionId, existing.id));
    prescriptionId = existing.id;
  } else {
    const [created] = await db
      .insert(prescriptionsTable)
      .values({
        consultationId: data.consultationId,
        patientId: consultation.patientId,
        doctorId,
        generalNotes: data.generalNotes,
      })
      .returning({ id: prescriptionsTable.id });
    prescriptionId = created.id;
  }

  await db.insert(prescriptionItemsTable).values(
    data.items.map((item) => ({
      prescriptionId,
      medication: item.medication,
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      instructions: item.instructions,
    })),
  );

  await logActivity({
    userId: session.userId,
    module: "recetas",
    action: existing ? "actualizar" : "emitir",
    recordId: prescriptionId,
    detail: `${data.items.length} medicamento(s)`,
  });

  revalidatePath("/recetas");
  revalidatePath(`/consultas/cita/${consultation.appointmentId}`);

  return actionSuccess({ prescriptionId });
}
