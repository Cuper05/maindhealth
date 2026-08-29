import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appointmentsTable, patientsTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { ensureLiveAppointmentMeetingUrl } from "@/lib/video/ensure-meeting";
import {
  createStationDailyToken,
  parseDailyRoomName,
} from "@/lib/video/daily";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { StationCancelSalaButton } from "@/components/station/StationCancelSalaButton";
import { StationSalaCallEndWatcher } from "@/components/station/StationSalaCallEndWatcher";
import { StationSalaOpenedSignal } from "@/components/station/StationSalaOpenedSignal";
import { StationAutoPrintWatcher } from "@/components/station/StationAutoPrintWatcher";
import {
  getLatestKioskSessionForAppointment,
  WAITING_DOCTOR_MAX_AGE_MS,
} from "@/lib/queries/station-waiting";

/**
 * Videoconsulta en la PC Dell. No abre si la espera ya expiró / no existe.
 * Siempre recrea sala Daily fresca para no unirse a rooms caducadas.
 */
export default async function EstacionSalaPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const session = await requireSession();
  if (!can(session?.role, "intake:view")) redirect("/");

  const { appointmentId: apptIdStr } = await params;
  const appointmentId = Number(apptIdStr);
  if (!Number.isFinite(appointmentId)) notFound();

  const kiosk = await getLatestKioskSessionForAppointment(appointmentId);
  const stale =
    !kiosk ||
    kiosk.status === "completed" ||
    (kiosk.status === "waiting_doctor" &&
      Date.now() - new Date(kiosk.updatedAt).getTime() > WAITING_DOCTOR_MAX_AGE_MS);

  const liveOk =
    kiosk &&
    (kiosk.status === "waiting_doctor" ||
      kiosk.deviceStatus === "doctor_live" ||
      kiosk.deviceStatus === "video_ready");

  if (stale || !liveOk) {
    redirect("/estacion");
  }

  const [appointment] = await db
    .select({
      id: appointmentsTable.id,
      modality: appointmentsTable.modality,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
      reason: appointmentsTable.reason,
      patientId: appointmentsTable.patientId,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientChart: patientsTable.chartNumber,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(eq(appointmentsTable.id, appointmentId));

  if (!appointment) notFound();

  // Misma sala que el médico (solo recrea si Daily ya no tiene la room).
  let meetingUrl: string | null = null;
  let roomEnsureFailed = false;
  if (appointment.modality === "teleconsulta") {
    meetingUrl = await ensureLiveAppointmentMeetingUrl(appointmentId);
    roomEnsureFailed = !meetingUrl;
  }

  const patientName = formatPersonName({
    firstName: appointment.patientFirstName,
    lastNamePaternal: appointment.patientLastNamePaternal,
    lastNameMaternal: appointment.patientLastNameMaternal,
  });
  const doctorName = formatPersonName({
    firstName: appointment.doctorFirstName,
    lastNamePaternal: appointment.doctorLastNamePaternal,
    lastNameMaternal: appointment.doctorLastNameMaternal,
  });
  const stationUserName = `Paciente — ${patientName}`;

  const roomName = parseDailyRoomName(meetingUrl);
  let dailyToken: string | null = null;
  if (meetingUrl && roomName) {
    const tokenResult = await createStationDailyToken({
      roomName,
      userName: stationUserName,
    });
    if (tokenResult.ok) {
      dailyToken = tokenResult.token;
    } else {
      console.error("[estacion/sala] token for auto-join failed", tokenResult.error);
    }
  }

  return (
    <div
      data-station-sala
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <StationSalaOpenedSignal appointmentId={appointmentId} />
      <StationSalaCallEndWatcher appointmentId={appointmentId} />
      <StationAutoPrintWatcher appointmentId={appointmentId} mode="staff" />
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3">
        <div className="min-w-0 truncate text-sm">
          <Link href="/estacion" className="text-teal-300 hover:underline">
            ← Estación
          </Link>
          <span className="mx-2 text-slate-600">·</span>
          <span className="font-medium text-white">{patientName}</span>
          <span className="text-slate-400"> · {appointment.patientChart}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StationCancelSalaButton appointmentId={appointmentId} />
          {meetingUrl ? (
            <a
              href={
                dailyToken
                  ? `${meetingUrl}${meetingUrl.includes("?") ? "&" : "?"}t=${encodeURIComponent(dailyToken)}`
                  : meetingUrl
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              Abrir en pestaña
            </a>
          ) : null}
        </div>
      </header>

      <p className="shrink-0 truncate border-b border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
        Video automático · Dr(a). {doctorName} · misma sala que el médico
        {appointment.reason ? ` · ${appointment.reason}` : ""}
      </p>

      {meetingUrl ? (
        <div className="relative min-h-0 flex-1">
          <DailyVideoRoom
            meetingUrl={meetingUrl}
            title="Videoconsulta — paciente en estación"
            userName={stationUserName}
            token={dailyToken}
            variant="station"
            autoJoin
            appointmentId={appointmentId}
          />
        </div>
      ) : (
        <section className="m-4 rounded-xl border border-red-400/60 bg-red-950/80 px-4 py-3 text-sm text-red-50">
          <p className="font-semibold">
            {roomEnsureFailed
              ? "No se pudo crear la sala Daily"
              : "No hay sala Daily disponible"}
          </p>
          <Link href="/estacion" className="mt-3 inline-block font-medium text-red-100 underline">
            Volver a estación
          </Link>
        </section>
      )}
    </div>
  );
}
