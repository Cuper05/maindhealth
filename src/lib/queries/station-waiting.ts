import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  patientsTable,
  stationKioskSessionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

/** Esperas sin abrir sala: más viejas que esto se archivan. */
export const WAITING_DOCTOR_MAX_AGE_MS = 1000 * 60 * 30; // 30 minutos

function draftFlags(draft: unknown): {
  videoOpened: boolean;
  doctorPresent: boolean;
  callEnded: boolean;
} {
  const d =
    draft && typeof draft === "object" ? (draft as Record<string, unknown>) : {};
  return {
    videoOpened: d.videoOpened === true,
    doctorPresent: d.doctorPresent === true,
    callEnded: d.callEnded === true,
  };
}

/**
 * Cierra esperas abandonadas por antigüedad o ya marcadas callEnded.
 * NO cierra solo porque la Dell abrió video: eso mataba la espera mientras
 * el médico aún entraba (y hacía callEnded=true → sacaba a la Dell de la sala).
 * El bucle de reabrir se evita filtrando videoOpened en la cola del autopilot.
 */
export async function expireStaleWaitingDoctorSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - WAITING_DOCTOR_MAX_AGE_MS);
  const waiting = await db
    .select({
      id: stationKioskSessionsTable.id,
      deviceStatus: stationKioskSessionsTable.deviceStatus,
      updatedAt: stationKioskSessionsTable.updatedAt,
      assessmentDraft: stationKioskSessionsTable.assessmentDraft,
    })
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.status, "waiting_doctor"));

  const toClose = waiting.filter((row) => {
    const flags = draftFlags(row.assessmentDraft);
    if (flags.callEnded || row.deviceStatus === "call_ended") return true;
    if (flags.doctorPresent || row.deviceStatus === "doctor_live") return false;
    return new Date(row.updatedAt).getTime() < cutoff.getTime();
  });

  if (toClose.length === 0) return 0;

  for (const row of toClose) {
    const prev =
      row.assessmentDraft && typeof row.assessmentDraft === "object"
        ? { ...(row.assessmentDraft as Record<string, unknown>) }
        : {};
    prev.callEnded = true;
    prev.callEndedAt = new Date().toISOString();
    prev.closedReason = "stale_waiting";

    await db
      .update(stationKioskSessionsTable)
      .set({
        status: "completed",
        currentStep: "welcome",
        deviceStatus: "call_ended",
        assessmentDraft: prev as typeof row.assessmentDraft,
        updatedAt: new Date(),
      })
      .where(eq(stationKioskSessionsTable.id, row.id));
  }

  console.info("[station-waiting] closed abandoned waiting_doctor", toClose.length);
  return toClose.length;
}

/** Cierra a mano una espera (Cancelar / Descartar en la Dell). */
export async function dismissWaitingDoctorForAppointment(
  appointmentId: number,
): Promise<number> {
  waitingCache = null;
  const rows = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(
      and(
        eq(stationKioskSessionsTable.appointmentId, appointmentId),
        eq(stationKioskSessionsTable.status, "waiting_doctor"),
      ),
    );

  for (const row of rows) {
    const draft =
      row.assessmentDraft && typeof row.assessmentDraft === "object"
        ? { ...(row.assessmentDraft as Record<string, unknown>) }
        : {};
    draft.callEnded = true;
    draft.callEndedAt = new Date().toISOString();
    draft.closedReason = "dismissed_by_station";

    await db
      .update(stationKioskSessionsTable)
      .set({
        status: "completed",
        currentStep: "welcome",
        deviceStatus: "call_ended",
        assessmentDraft: draft as typeof row.assessmentDraft,
        updatedAt: new Date(),
      })
      .where(eq(stationKioskSessionsTable.id, row.id));
  }

  return rows.length;
}

const WAITING_CACHE_MS = 4000;
const EXPIRE_EVERY_MS = 60_000;
let waitingCache: { at: number; data: WaitingDoctorRow[] } | null = null;
let lastExpireAt = 0;

type WaitingDoctorRow = {
  sessionId: number;
  appointmentId: number;
  patientId: number;
  chartNumber: string;
  patientName: string;
  doctorName: string;
  meetingUrl: string | null;
  modality: string;
  updatedAt: Date;
  redFlags: string[];
  summary: string | null;
  roomError: string | null;
};

/**
 * Pacientes de kiosk escalados a teleconsulta (status waiting_doctor), solo recientes
 * y que la Dell aún no haya abierto (si ya abrió, se archivan en expire).
 */
export async function getWaitingDoctorStationSessions() {
  if (waitingCache && Date.now() - waitingCache.at < WAITING_CACHE_MS) {
    return waitingCache.data;
  }

  if (Date.now() - lastExpireAt > EXPIRE_EVERY_MS) {
    lastExpireAt = Date.now();
    try {
      await expireStaleWaitingDoctorSessions();
    } catch (err) {
      console.error("[station-waiting] expire stale", err);
    }
  }

  const cutoff = new Date(Date.now() - WAITING_DOCTOR_MAX_AGE_MS);

  const rows = await db
    .select({
      sessionId: stationKioskSessionsTable.id,
      status: stationKioskSessionsTable.status,
      deviceStatus: stationKioskSessionsTable.deviceStatus,
      updatedAt: stationKioskSessionsTable.updatedAt,
      assessmentDraft: stationKioskSessionsTable.assessmentDraft,
      appointmentId: appointmentsTable.id,
      meetingUrl: appointmentsTable.meetingUrl,
      modality: appointmentsTable.modality,
      patientId: patientsTable.id,
      chartNumber: patientsTable.chartNumber,
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(stationKioskSessionsTable)
    .innerJoin(
      appointmentsTable,
      eq(stationKioskSessionsTable.appointmentId, appointmentsTable.id),
    )
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(
      and(
        eq(stationKioskSessionsTable.status, "waiting_doctor"),
        gte(stationKioskSessionsTable.updatedAt, cutoff),
      ),
    )
    .orderBy(desc(stationKioskSessionsTable.updatedAt));

  // Solo esperas “nuevas”: la Dell aún no abrió la sala.
  const fresh = rows.filter((row) => {
    const flags = draftFlags(row.assessmentDraft);
    if (flags.videoOpened || flags.doctorPresent || flags.callEnded) return false;
    if (
      row.deviceStatus === "video_ready" ||
      row.deviceStatus === "doctor_live" ||
      row.deviceStatus === "call_ended"
    ) {
      return false;
    }
    return true;
  });

  const seenAppointments = new Set<number>();
  const uniqueRows = fresh.filter((row) => {
    if (seenAppointments.has(row.appointmentId)) return false;
    seenAppointments.add(row.appointmentId);
    return true;
  });

  const data: WaitingDoctorRow[] = uniqueRows.map((row) => ({
    sessionId: row.sessionId,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    chartNumber: row.chartNumber,
    patientName: formatPersonName(row),
    doctorName: row.doctorFirstName
      ? formatPersonName({
          firstName: row.doctorFirstName,
          lastNamePaternal: row.doctorLastNamePaternal ?? "",
          lastNameMaternal: row.doctorLastNameMaternal,
        })
      : "Sin asignar",
    meetingUrl: row.meetingUrl,
    modality: row.modality,
    updatedAt: row.updatedAt,
    redFlags: row.assessmentDraft?.redFlags ?? [],
    summary: row.assessmentDraft?.summary ?? null,
    roomError: row.assessmentDraft?.roomError ?? null,
  }));
  waitingCache = { at: Date.now(), data };
  return data;
}

/** Estado de la sesión kiosk de una cita (para no abrir salas muertas). */
export async function getLatestKioskSessionForAppointment(appointmentId: number) {
  const [row] = await db
    .select({
      id: stationKioskSessionsTable.id,
      status: stationKioskSessionsTable.status,
      deviceStatus: stationKioskSessionsTable.deviceStatus,
      updatedAt: stationKioskSessionsTable.updatedAt,
    })
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.appointmentId, appointmentId))
    .orderBy(desc(stationKioskSessionsTable.updatedAt))
    .limit(1);

  return row ?? null;
}
