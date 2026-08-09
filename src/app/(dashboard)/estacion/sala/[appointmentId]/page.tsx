import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appointmentsTable, patientsTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { ensureAppointmentMeetingUrl } from "@/lib/video/ensure-meeting";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonSecondaryClassName, cardClassName } from "@/lib/ui/classes";

/**
 * Endpoint de videoconsulta en la PC Dell de la estación (cámara + audífonos).
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
  if (appointment.modality === "teleconsulta" && !meetingUrl) {
    meetingUrl = await ensureAppointmentMeetingUrl(appointmentId);
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

  return (
    <div>
      <PageHeader
        title="Sala de videoconsulta — estación"
        description={`${patientName} · ${appointment.patientChart}`}
        backHref="/estacion"
        action={
          <div className="flex flex-wrap gap-2">
            {meetingUrl ? (
              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonSecondaryClassName}
              >
                Abrir en pestaña
              </a>
            ) : null}
            <Link href={`/consultas/cita/${appointmentId}`} className={buttonSecondaryClassName}>
              Expediente / notas médicas
            </Link>
          </div>
        }
      />

      <section className={`${cardClassName} mb-6 border-[#1d6eb8]/30 bg-[#f0f7ff]`}>
        <p className="text-sm font-semibold text-[#1a4d7c]">
          Esta PC (Dell) es el lado paciente de la llamada
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Usa la cámara y audífonos conectados aquí. El médico remoto (
          <strong>Dr(a). {doctorName}</strong>) se une desde su propia sesión (agenda o consulta), no
          desde el kiosk táctil.
        </p>
        {appointment.reason ? (
          <p className="mt-2 text-xs text-slate-500">Motivo: {appointment.reason}</p>
        ) : null}
      </section>

      {meetingUrl ? (
        <section>
          <DailyVideoRoom
            meetingUrl={meetingUrl}
            title="Videoconsulta — paciente en estación"
            userName={patientName}
          />
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No hay sala Daily disponible. Revisa la configuración (`VIDEO_API_KEY`) o vuelve a abrir
          desde la cola de estación.
        </section>
      )}
    </div>
  );
}
