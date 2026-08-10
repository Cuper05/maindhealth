import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationsTable, patientsTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { sendExpoPushToUsers } from "@/lib/push/expo";

/**
 * Avisa a médicos (users.id) que un paciente de estación espera teleconsulta.
 * También envía push Expo a dispositivos registrados (app móvil del médico).
 */
export async function notifyDoctorsStationTeleconsulta(input: {
  appointmentId: number;
  patientId: number;
  doctorUserIds: number[];
  redFlags: string[];
  meetingUrl: string | null;
}) {
  const uniqueIds = [...new Set(input.doctorUserIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return { notified: 0, pushSent: 0 };

  const [patient] = await db
    .select({
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
      chartNumber: patientsTable.chartNumber,
    })
    .from(patientsTable)
    .where(eq(patientsTable.id, input.patientId));

  const patientName = patient ? formatPersonName(patient) : `Paciente #${input.patientId}`;
  const chart = patient?.chartNumber ? ` (${patient.chartNumber})` : "";
  const flags =
    input.redFlags.length > 0 ? input.redFlags.slice(0, 4).join("; ") : "Fuera de protocolo autónomo";

  const activeDoctors = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(inArray(usersTable.id, uniqueIds), eq(usersTable.active, true)));

  // Médico remoto: Daily directo si hay sala; si no, consulta con #video.
  // La PC Dell de estación auto-abre /estacion/sala (lado paciente) — no Agenda.
  const href =
    input.meetingUrl?.trim() ||
    `/consultas/cita/${input.appointmentId}#video`;
  const referenceKey = `estacion-teleconsulta:${input.appointmentId}`;
  let notified = 0;

  const title = `Estación: teleconsulta — ${patientName}`;
  const body = `${patientName}${chart} espera médico. ${flags}${input.meetingUrl ? " · Sala lista." : " · Sin sala Daily aún."} Un clic abre la videollamada. El paciente ya entra solo en la Dell de estación.`;

  for (const doctor of activeDoctors) {
    const payload = {
      userId: doctor.id,
      type: "videollamada_lista",
      title,
      body,
      href,
      referenceKey,
    };

    const [row] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(eq(notificationsTable.userId, doctor.id), eq(notificationsTable.referenceKey, referenceKey)),
      );

    if (!row) {
      await db.insert(notificationsTable).values(payload);
    } else {
      await db
        .update(notificationsTable)
        .set({
          type: payload.type,
          title: payload.title,
          body: payload.body,
          href: payload.href,
          readAt: null,
        })
        .where(eq(notificationsTable.id, row.id));
    }
    notified += 1;
  }

  let pushSent = 0;
  try {
    const pushResult = await sendExpoPushToUsers(
      activeDoctors.map((d) => d.id),
      {
        title,
        body: `${patientName}${chart} espera teleconsulta. Toca para unirte.`,
        data: {
          appointmentId: input.appointmentId,
          meetingUrl: input.meetingUrl?.trim() || null,
          href,
        },
      },
    );
    pushSent = pushResult.sent;
  } catch (err) {
    console.error("[notify-escalation] expo push failed", err);
  }

  return { notified, pushSent };
}
