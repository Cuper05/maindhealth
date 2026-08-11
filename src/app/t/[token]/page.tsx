import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  patientsTable,
  teleconsultaJoinTokensTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { markTeleconsultaJoined } from "@/lib/alerts/teleconsulta-escalate";
import { ensureAppointmentMeetingUrl } from "@/lib/video/ensure-meeting";
import {
  createStationDailyToken,
  parseDailyRoomName,
} from "@/lib/video/daily";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";

export const dynamic = "force-dynamic";

/**
 * Public deep link for remote doctors: SMS/WhatsApp → browser → immediate video.
 * No login. Multi-device responsive.
 */
export default async function TeleconsultaJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token) {
    return <JoinError title="Enlace inválido" body="Falta el token de acceso." />;
  }

  const [row] = await db
    .select({
      id: teleconsultaJoinTokensTable.id,
      appointmentId: teleconsultaJoinTokensTable.appointmentId,
      userId: teleconsultaJoinTokensTable.userId,
      expiresAt: teleconsultaJoinTokensTable.expiresAt,
      usedAt: teleconsultaJoinTokensTable.usedAt,
      revokedAt: teleconsultaJoinTokensTable.revokedAt,
    })
    .from(teleconsultaJoinTokensTable)
    .where(eq(teleconsultaJoinTokensTable.token, token));

  if (!row) {
    return <JoinError title="Enlace no válido" body="Este enlace no existe o ya expiró." />;
  }

  if (row.revokedAt) {
    return (
      <JoinError
        title="Enlace cancelado"
        body="Otro médico ya atendió esta teleconsulta, o el enlace fue revocado."
      />
    );
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return (
      <JoinError
        title="Enlace expirado"
        body="Solicite un nuevo aviso desde la estación o contacte a MaindHealth."
      />
    );
  }

  const [appointment] = await db
    .select({
      id: appointmentsTable.id,
      modality: appointmentsTable.modality,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
      reason: appointmentsTable.reason,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientChart: patientsTable.chartNumber,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .where(eq(appointmentsTable.id, row.appointmentId));

  if (!appointment) {
    return <JoinError title="Cita no encontrada" body="No hay teleconsulta asociada a este enlace." />;
  }

  let doctorName = "Médico";
  if (row.userId) {
    const [doctor] = await db
      .select({
        firstName: usersTable.firstName,
        lastNamePaternal: usersTable.lastNamePaternal,
        lastNameMaternal: usersTable.lastNameMaternal,
      })
      .from(usersTable)
      .where(eq(usersTable.id, row.userId));
    if (doctor) doctorName = formatPersonName(doctor);
  }

  const patientName = formatPersonName({
    firstName: appointment.patientFirstName,
    lastNamePaternal: appointment.patientLastNamePaternal,
    lastNameMaternal: appointment.patientLastNameMaternal,
  });

  // Mark token used (first open) and stop escalation.
  if (!row.usedAt) {
    await db
      .update(teleconsultaJoinTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(teleconsultaJoinTokensTable.id, row.id),
          isNull(teleconsultaJoinTokensTable.usedAt),
        ),
      );
  }

  await markTeleconsultaJoined({
    appointmentId: appointment.id,
    doctorUserId: row.userId,
    joinTokenId: row.id,
  });

  let meetingUrl = appointment.meetingUrl;
  if (!meetingUrl && appointment.modality === "teleconsulta") {
    meetingUrl = await ensureAppointmentMeetingUrl(appointment.id);
  }

  const roomName =
    appointment.meetingRoomName?.trim() || parseDailyRoomName(meetingUrl);
  let dailyToken: string | null = null;
  if (meetingUrl && roomName) {
    const tokenResult = await createStationDailyToken({
      roomName,
      userName: doctorName,
    });
    if (tokenResult.ok) {
      dailyToken = tokenResult.token;
    } else {
      console.error("[t/token] Daily token failed", tokenResult.error);
    }
  }

  if (!meetingUrl) {
    return (
      <JoinError
        title="Sala no disponible"
        body="No hay sala de video lista. Espere un momento e intente de nuevo, o contacte a la estación."
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3">
        <div className="min-w-0 truncate text-sm">
          <span className="font-semibold text-teal-300">MaindHealth</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="font-medium">{patientName}</span>
          {appointment.patientChart ? (
            <span className="text-slate-400"> · {appointment.patientChart}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-slate-400">{doctorName}</span>
      </header>
      <p className="shrink-0 truncate border-b border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
        Teleconsulta urgente · permita cámara y micrófono
        {appointment.reason ? ` · ${appointment.reason}` : ""}
      </p>
      <div className="relative min-h-0 flex-1">
        <DailyVideoRoom
          meetingUrl={meetingUrl}
          title="Teleconsulta"
          userName={doctorName}
          token={dailyToken}
          variant="station"
          autoJoin
        />
      </div>
    </div>
  );
}

function JoinError({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
      <p className="text-sm font-semibold tracking-wide text-teal-300">MaindHealth</p>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-300">{body}</p>
    </div>
  );
}
