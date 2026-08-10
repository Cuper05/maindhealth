import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appointmentsTable, patientsTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { ensureAppointmentMeetingUrl } from "@/lib/video/ensure-meeting";
import {
  createStationDailyToken,
  parseDailyRoomName,
} from "@/lib/video/daily";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";

/**
 * Endpoint de videoconsulta en la PC Dell de la estación (cámara + audífonos).
 * Fullscreen + auto-join (sin lobby "Are you ready to join?").
 * El kiosk táctil ViewSonic no une Daily; el médico remoto entra desde agenda/consulta.
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

  let meetingUrl = appointment.meetingUrl;
  let roomEnsureFailed = false;
  if (appointment.modality === "teleconsulta" && !meetingUrl) {
    meetingUrl = await ensureAppointmentMeetingUrl(appointmentId);
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

  const roomName =
    appointment.meetingRoomName?.trim() || parseDailyRoomName(meetingUrl);
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
          {meetingUrl ? (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              Abrir en pestaña
            </a>
          ) : null}
          <Link
            href={`/consultas/cita/${appointmentId}`}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Expediente
          </Link>
        </div>
      </header>

      <p className="shrink-0 truncate border-b border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
        Video automático en esta PC · Dr(a). {doctorName} entra desde su consulta
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
          />
        </div>
      ) : (
        <section className="m-4 rounded-xl border border-red-400/60 bg-red-950/80 px-4 py-3 text-sm text-red-50">
          <p className="font-semibold">
            {roomEnsureFailed
              ? "No se pudo crear la sala Daily"
              : "No hay sala Daily disponible"}
          </p>
          <p className="mt-1 text-red-100/90">
            Revisa que `VIDEO_API_KEY` (Daily.co) esté configurada en Vercel/producción y vuelve a
            abrir esta sala. El paciente sigue en cola de estación; el médico remoto también puede
            intentar desde Consulta.
          </p>
          <Link
            href={`/estacion/sala/${appointmentId}`}
            className="mt-3 inline-block font-medium text-red-100 underline"
          >
            Reintentar crear sala
          </Link>
        </section>
      )}
    </div>
  );
}
