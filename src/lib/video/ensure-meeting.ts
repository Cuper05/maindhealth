import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointmentsTable } from "@/lib/db/schema";
import { createDailyRoom } from "@/lib/video/daily";

/**
 * Ensures a teleconsulta appointment has a Daily room URL.
 * Creates one on demand when older appointments were saved before Daily was configured.
 */
export async function ensureAppointmentMeetingUrl(appointmentId: number): Promise<string | null> {
  const [row] = await db
    .select({
      id: appointmentsTable.id,
      modality: appointmentsTable.modality,
      meetingUrl: appointmentsTable.meetingUrl,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  if (!row) return null;
  if (row.modality !== "teleconsulta") return row.meetingUrl;
  if (row.meetingUrl) return row.meetingUrl;

  const created = await createDailyRoom(appointmentId);
  if (!created.ok) return null;

  await db
    .update(appointmentsTable)
    .set({
      meetingUrl: created.room.url,
      meetingRoomName: created.room.name,
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, appointmentId));

  return created.room.url;
}
