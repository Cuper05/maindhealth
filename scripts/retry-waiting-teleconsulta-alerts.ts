import { config } from "dotenv";
config({ path: ".env.local" });

import { desc, eq } from "drizzle-orm";
import { isTwilioConfigured } from "../src/lib/alerts/twilio";
import {
  ensureDoctorsHaveAlertPhones,
  startTeleconsultaEscalation,
} from "../src/lib/alerts/teleconsulta-escalate";
import { db } from "../src/lib/db";
import {
  appointmentsTable,
  notificationsTable,
  rolesTable,
  stationKioskSessionsTable,
  teleconsultaAlertAttemptsTable,
  teleconsultaEscalationsTable,
  usersTable,
} from "../src/lib/db/schema";
import { getWaitingDoctorStationSessions } from "../src/lib/queries/station-waiting";

async function restoreLatestAbandonedTeleconsulta() {
  const sessions = await db
    .select({
      id: stationKioskSessionsTable.id,
      appointmentId: stationKioskSessionsTable.appointmentId,
      status: stationKioskSessionsTable.status,
      assessmentDraft: stationKioskSessionsTable.assessmentDraft,
    })
    .from(stationKioskSessionsTable)
    .orderBy(desc(stationKioskSessionsTable.updatedAt))
    .limit(12);

  const candidate = sessions.find((row) => {
    if (!row.appointmentId) return false;
    if (row.status === "waiting_doctor") return true;
    if (row.status !== "abandoned" && row.status !== "completed") return false;
    const draft =
      row.assessmentDraft && typeof row.assessmentDraft === "object"
        ? (row.assessmentDraft as Record<string, unknown>)
        : {};
    return draft.videoOpened === true || draft.requiresDoctor === true;
  });

  if (!candidate?.appointmentId) return null;

  const draft =
    candidate.assessmentDraft && typeof candidate.assessmentDraft === "object"
      ? { ...(candidate.assessmentDraft as Record<string, unknown>) }
      : {};
  delete draft.callEnded;
  delete draft.callEndedAt;
  delete draft.closedReason;
  draft.doctorPresent = false;

  await db
    .update(stationKioskSessionsTable)
    .set({
      status: "waiting_doctor",
      currentStep: "waiting",
      deviceStatus: "video_ready",
      assessmentDraft: draft as typeof candidate.assessmentDraft,
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.id, candidate.id));

  return candidate.appointmentId;
}

async function main() {
  const fallback = await ensureDoctorsHaveAlertPhones();
  const restoredAppt = await restoreLatestAbandonedTeleconsulta();
  const doctors = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      phone: usersTable.phone,
      teleconsultaAvailable: usersTable.teleconsultaAvailable,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(rolesTable.code, "doctor"));

  const waiting = await getWaitingDoctorStationSessions();
  console.log(
    JSON.stringify(
      {
        twilioLocal: isTwilioConfigured(),
        fallback,
        restoredAppt,
        doctors,
        waiting: waiting.map((w) => ({
          appt: w.appointmentId,
          patient: w.patientName,
        })),
      },
      null,
      2,
    ),
  );

  if (waiting.length === 0) {
    console.log("NO_WAITING");
    return;
  }

  for (const item of waiting) {
    const [appt] = await db
      .select({
        id: appointmentsTable.id,
        doctorId: appointmentsTable.doctorId,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, item.appointmentId));

    const result = await startTeleconsultaEscalation({
      appointmentId: item.appointmentId,
      assignedDoctorId: appt?.doctorId ?? doctors[0]?.id ?? null,
      preferredIds: doctors.map((d) => d.id),
      redFlags: item.redFlags,
      force: true,
    });

    if (!isTwilioConfigured()) {
      const [esc] = await db
        .select({ id: teleconsultaEscalationsTable.id })
        .from(teleconsultaEscalationsTable)
        .where(eq(teleconsultaEscalationsTable.appointmentId, item.appointmentId));
      if (esc) {
        await db
          .update(teleconsultaEscalationsTable)
          .set({
            indexInQueue: -1,
            currentDoctorUserId: null,
            nextActionAt: new Date(Date.now() - 1000),
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(teleconsultaEscalationsTable.id, esc.id));
      }
    }

    await db.insert(notificationsTable).values({
      userId: doctors[0]?.id ?? 2,
      type: "videollamada_lista",
      title: `Estación: teleconsulta — ${item.patientName}`,
      body: `${item.patientName} espera médico. Sala lista. Abra la consulta.`,
      href: `/consultas/cita/${item.appointmentId}?focus=video`,
      referenceKey: `estacion-teleconsulta:${item.appointmentId}:retry`,
    }).catch(() => undefined);

    const attempts = await db
      .select({
        id: teleconsultaAlertAttemptsTable.id,
        status: teleconsultaAlertAttemptsTable.status,
        voiceCallSid: teleconsultaAlertAttemptsTable.voiceCallSid,
        smsSid: teleconsultaAlertAttemptsTable.smsSid,
        errorDetail: teleconsultaAlertAttemptsTable.errorDetail,
      })
      .from(teleconsultaAlertAttemptsTable)
      .where(eq(teleconsultaAlertAttemptsTable.appointmentId, item.appointmentId));

    console.log(
      JSON.stringify({ appointmentId: item.appointmentId, escalate: result, attempts }, null, 2),
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
