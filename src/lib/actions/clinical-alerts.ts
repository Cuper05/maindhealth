"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { clinicalAlertsTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";

export async function acknowledgeClinicalAlert(alertId: number) {
  const session = await getActionSession("alerts:write");
  if ("error" in session) return actionError(session.error);

  const [alert] = await db
    .select()
    .from(clinicalAlertsTable)
    .where(eq(clinicalAlertsTable.id, alertId));

  if (!alert) return actionError("Alerta no encontrada");
  if (alert.acknowledgedAt) return actionSuccess({ alertId });

  await db
    .update(clinicalAlertsTable)
    .set({
      acknowledgedAt: new Date(),
      acknowledgedById: session.userId,
    })
    .where(eq(clinicalAlertsTable.id, alertId));

  await logActivity({
    userId: session.userId,
    module: "alertas",
    action: "actualizar",
    recordId: alertId,
    detail: alert.message,
  });

  revalidatePath("/alertas");
  revalidatePath("/reportes");
  revalidatePath(`/pacientes/${alert.patientId}`);
  return actionSuccess({ alertId });
}
