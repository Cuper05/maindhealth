import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  consultationsTable,
  patientsTable,
  usersTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { getPaymentForAppointment } from "@/lib/queries/portal";
import { getVisitIntakeByAppointment } from "@/lib/queries/visit-intake";
import { IntakeSummary } from "@/components/intake/IntakeSummary";
import { PaymentPanel } from "@/components/forms/PaymentPanel";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) notFound();

  const session = await requireSession();

  const [row] = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      endAt: appointmentsTable.endAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      notes: appointmentsTable.notes,
      meetingUrl: appointmentsTable.meetingUrl,
      patientId: appointmentsTable.patientId,
      statusName: catalogAppointmentStatusesTable.name,
      typeName: catalogAppointmentTypesTable.name,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientChart: patientsTable.chartNumber,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
      doctorSpecialty: usersTable.specialty,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
    )
    .leftJoin(
      catalogAppointmentTypesTable,
      eq(appointmentsTable.appointmentTypeId, catalogAppointmentTypesTable.id),
    )
    .where(eq(appointmentsTable.id, appointmentId));

  if (!row) notFound();

  const vitals = await db
    .select()
    .from(vitalSignsTable)
    .where(eq(vitalSignsTable.appointmentId, appointmentId))
    .orderBy(desc(vitalSignsTable.recordedAt))
    .limit(1);

  const [consultation] = await db
    .select({ id: consultationsTable.id })
    .from(consultationsTable)
    .where(eq(consultationsTable.appointmentId, appointmentId));

  const payment = await getPaymentForAppointment(appointmentId);
  const intake = await getVisitIntakeByAppointment(appointmentId);
  const intakeComplete = Boolean(intake);

  const patientName = formatPersonName({
    firstName: row.patientFirstName,
    lastNamePaternal: row.patientLastNamePaternal,
    lastNameMaternal: row.patientLastNameMaternal,
  });

  return (
    <div>
      <PageHeader
        title="Detalle de cita"
        description={`${patientName} · ${row.patientChart}`}
        backHref="/agenda"
      />

      <section className={`${cardClassName} mb-6`}>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Info label="Fecha / hora" value={row.startAt.toLocaleString("es-MX")} />
          <Info label="Estatus" value={row.statusName} />
          <Info label="Médico" value={formatPersonName({
            firstName: row.doctorFirstName,
            lastNamePaternal: row.doctorLastNamePaternal,
            lastNameMaternal: row.doctorLastNameMaternal,
          })} />
          <Info label="Especialidad" value={row.doctorSpecialty} />
          <Info label="Tipo" value={row.typeName} />
          <Info label="Modalidad" value={row.modality} />
          <Info label="Motivo" value={row.reason} className="sm:col-span-2" />
          {row.meetingUrl && row.modality === "teleconsulta" && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Videollamada</dt>
              <dd className="mt-2">
                <DailyVideoRoom meetingUrl={row.meetingUrl} title="Sala de teleconsulta" />
              </dd>
            </div>
          )}
        </dl>
      </section>

      {!intakeComplete && (
        <section className={`${cardClassName} mb-6 border-amber-200 bg-amber-50`}>
          <p className="text-sm font-medium text-amber-900">Intake pendiente</p>
          <p className="mt-1 text-sm text-amber-800">
            El paciente debe completar el cuestionario de estación antes de triage y consulta.
          </p>
          {can(session?.role, "intake:write") && (
            <Link
              href={`/estacion/flujo?cita=${appointmentId}`}
              className="mt-3 inline-block rounded-lg bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800"
            >
              Iniciar cuestionario
            </Link>
          )}
        </section>
      )}

      {intake && <div className="mb-6"><IntakeSummary intake={intake} /></div>}

      <div className="flex flex-wrap gap-3">
        {can(session?.role, "vitals:write") && intakeComplete && (
          <Link
            href={`/triage/nuevo?patientId=${row.patientId}&appointmentId=${appointmentId}&redirect=/agenda/${appointmentId}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Capturar triage
          </Link>
        )}
        {can(session?.role, "consultations:view") && intakeComplete && (
          <Link
            href={`/consultas/cita/${appointmentId}`}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800"
          >
            {consultation ? "Ver consulta" : "Iniciar consulta"}
          </Link>
        )}
        <Link
          href={`/pacientes/${row.patientId}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Ver paciente
        </Link>
      </div>

      {vitals[0] && (
        <section className={`${cardClassName} mt-6`}>
          <h2 className="mb-3 font-medium text-slate-900">Últimos signos vitales</h2>
          <p className="text-sm text-slate-600">
            PA {vitals[0].systolicPressure}/{vitals[0].diastolicPressure} · FC{" "}
            {vitals[0].heartRate ?? "—"} · SpO2 {vitals[0].oxygenSaturation ?? "—"} · Temp{" "}
            {vitals[0].temperature ?? "—"} °C
          </p>
        </section>
      )}

      <div className="mt-6">
        <PaymentPanel
          appointmentId={appointmentId}
          payment={payment}
          canWrite={can(session?.role, "payments:write")}
        />
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
