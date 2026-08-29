import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointmentsTable } from "@/lib/db/schema";
import { createDailyRoom, dailyRoomExists, parseDailyRoomName } from "@/lib/video/daily";

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

  return recreateAppointmentMeetingUrl(appointmentId);
}

/**
 * Misma sala para Dell y médico.
 * Solo recrea si no hay URL o Daily ya no tiene esa room (expirada/borrada).
 * Nunca recrear “por si acaso”: eso deja al celular en una sala y a la estación en otra.
 */
export async function ensureLiveAppointmentMeetingUrl(
  appointmentId: number,
): Promise<string | null> {
  const [row] = await db
    .select({
      id: appointmentsTable.id,
      modality: appointmentsTable.modality,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  if (!row || row.modality !== "teleconsulta") return null;

  const roomName =
    row.meetingRoomName?.trim() || parseDailyRoomName(row.meetingUrl);
  if (row.meetingUrl && roomName) {
    const alive = await dailyRoomExists(roomName);
    if (alive) return row.meetingUrl;
    console.info("[daily] room gone, recreating", roomName);
  }

  return recreateAppointmentMeetingUrl(appointmentId);
}

/**
 * Crea una sala Daily NUEVA y actualiza la cita.
 */
export async function recreateAppointmentMeetingUrl(
  appointmentId: number,
): Promise<string | null> {
  const [row] = await db
    .select({
      id: appointmentsTable.id,
      modality: appointmentsTable.modality,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));

  if (!row || row.modality !== "teleconsulta") return null;

  const created = await createDailyRoom(appointmentId);
  if (!created.ok) {
    console.error("[daily] recreate room failed", created.error);
    return null;
  }

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
