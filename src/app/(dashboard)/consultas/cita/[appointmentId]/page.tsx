import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  consultationsTable,
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  usersTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConsultationWorkspace } from "@/components/forms/ConsultationWorkspace";
import { cardClassName } from "@/lib/ui/classes";

export default async function ConsultationByAppointmentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId: apptIdStr } = await params;
  const appointmentId = Number(apptIdStr);
  if (!Number.isFinite(appointmentId)) notFound();

  const session = await requireSession();

  const [appointment] = await db
    .select({
      id: appointmentsTable.id,
      reason: appointmentsTable.reason,
      meetingUrl: appointmentsTable.meetingUrl,
      patientId: appointmentsTable.patientId,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientChart: patientsTable.chartNumber,
      patientBirthDate: patientsTable.birthDate,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(eq(appointmentsTable.id, appointmentId));

  if (!appointment) notFound();

  const [consultation] = await db
    .select()
    .from(consultationsTable)
    .where(eq(consultationsTable.appointmentId, appointmentId));

  let prescriptionData = null;
  if (consultation) {
    const [prescription] = await db
      .select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.consultationId, consultation.id));

    if (prescription) {
      const items = await db
        .select()
        .from(prescriptionItemsTable)
        .where(eq(prescriptionItemsTable.prescriptionId, prescription.id));
      prescriptionData = {
        id: prescription.id,
        generalNotes: prescription.generalNotes,
        items: items.map((i) => ({
          medication: i.medication,
          dose: i.dose ?? undefined,
          frequency: i.frequency ?? undefined,
          duration: i.duration ?? undefined,
          route: i.route ?? undefined,
          instructions: i.instructions ?? undefined,
        })),
      };
    }
  }

  const [latestVitals] = await db
    .select()
    .from(vitalSignsTable)
    .where(eq(vitalSignsTable.appointmentId, appointmentId))
    .orderBy(desc(vitalSignsTable.recordedAt))
    .limit(1);

  const patientName = formatPersonName({
    firstName: appointment.patientFirstName,
    lastNamePaternal: appointment.patientLastNamePaternal,
    lastNameMaternal: appointment.patientLastNameMaternal,
  });

  return (
    <div>
      <PageHeader
        title="Consulta médica"
        description={`${patientName} · ${appointment.patientChart}`}
        backHref={`/agenda/${appointmentId}`}
        action={
          appointment.meetingUrl ? (
            <a
              href={appointment.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800"
            >
              Abrir videollamada
            </a>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <aside className={`${cardClassName} lg:col-span-1`}>
          <h2 className="mb-3 font-medium text-slate-900">Paciente</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium">{patientName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Expediente</dt>
              <dd>{appointment.patientChart}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Motivo de cita</dt>
              <dd>{appointment.reason ?? "—"}</dd>
            </div>
          </dl>
          <Link
            href={`/pacientes/${appointment.patientId}?tab=expediente`}
            className="mt-4 inline-block text-sm text-teal-700 hover:underline"
          >
            Ver expediente →
          </Link>

          {latestVitals && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-slate-800">Signos vitales</h3>
              <p className="text-sm text-slate-600">
                PA {latestVitals.systolicPressure}/{latestVitals.diastolicPressure}
                <br />
                FC {latestVitals.heartRate ?? "—"} · SpO2 {latestVitals.oxygenSaturation ?? "—"}
                <br />
                Temp {latestVitals.temperature ?? "—"} °C · Peso {latestVitals.weight ?? "—"} kg
              </p>
            </div>
          )}
        </aside>

        <div className="lg:col-span-2">
          <ConsultationWorkspace
            appointmentId={appointmentId}
            consultation={consultation ?? null}
            prescription={prescriptionData}
            canWriteConsultation={can(session?.role, "consultations:write")}
            canWritePrescription={can(session?.role, "prescriptions:write")}
          />
        </div>
      </div>
    </div>
  );
}
