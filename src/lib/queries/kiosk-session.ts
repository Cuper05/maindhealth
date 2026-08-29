import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stationKioskSessionsTable } from "@/lib/db/schema";
import type {
  KioskAssessmentDraft,
  KioskVitalsDraft,
} from "@/lib/db/schema/station-kiosk";

/** Última sesión de kiosco ligada a una cita (para vista del médico). */
export async function getKioskSessionByAppointment(appointmentId: number) {
  const [row] = await db
    .select({
      id: stationKioskSessionsTable.id,
      status: stationKioskSessionsTable.status,
      paymentStatus: stationKioskSessionsTable.paymentStatus,
      clinicalDraft: stationKioskSessionsTable.clinicalDraft,
      vitalsDraft: stationKioskSessionsTable.vitalsDraft,
      assessmentDraft: stationKioskSessionsTable.assessmentDraft,
      deviceStatus: stationKioskSessionsTable.deviceStatus,
      updatedAt: stationKioskSessionsTable.updatedAt,
    })
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.appointmentId, appointmentId))
    .orderBy(desc(stationKioskSessionsTable.updatedAt))
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    clinicalDraft: (row.clinicalDraft ?? {}) as Record<string, unknown>,
    vitalsDraft: (row.vitalsDraft ?? null) as KioskVitalsDraft | null,
    assessmentDraft: (row.assessmentDraft ?? null) as KioskAssessmentDraft | null,
  };
}
