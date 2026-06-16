import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  clinicalRecordsTable,
  consultationsTable,
  patientsTable,
  prescriptionsTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClinicalRecordForm } from "@/components/forms/ClinicalRecordForm";
import { cardClassName } from "@/lib/ui/classes";

export default async function PacienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "resumen" } = await searchParams;
  const patientId = Number(id);
  if (!Number.isFinite(patientId)) notFound();

  const session = await requireSession();
  const canWrite = can(session?.role, "patients:write");

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId));

  if (!patient) notFound();

  const [record] = await db
    .select()
    .from(clinicalRecordsTable)
    .where(eq(clinicalRecordsTable.patientId, patientId));

  const appointments = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      statusName: catalogAppointmentStatusesTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
    )
    .where(eq(appointmentsTable.patientId, patientId))
    .orderBy(desc(appointmentsTable.startAt))
    .limit(10);

  const vitals = await db
    .select()
    .from(vitalSignsTable)
    .where(eq(vitalSignsTable.patientId, patientId))
    .orderBy(desc(vitalSignsTable.recordedAt))
    .limit(10);

  const consultations = await db
    .select({
      id: consultationsTable.id,
      diagnosis: consultationsTable.diagnosis,
      consultedAt: consultationsTable.consultedAt,
      appointmentId: consultationsTable.appointmentId,
    })
    .from(consultationsTable)
    .where(eq(consultationsTable.patientId, patientId))
    .orderBy(desc(consultationsTable.consultedAt))
    .limit(10);

  const prescriptions = await db
    .select({
      id: prescriptionsTable.id,
      issuedAt: prescriptionsTable.issuedAt,
    })
    .from(prescriptionsTable)
    .where(eq(prescriptionsTable.patientId, patientId))
    .orderBy(desc(prescriptionsTable.issuedAt))
    .limit(10);

  const tabs = [
    ["resumen", "Resumen"],
    ["expediente", "Expediente"],
    ["citas", "Citas"],
    ["signos", "Signos vitales"],
    ["consultas", "Consultas"],
    ["recetas", "Recetas"],
  ] as const;

  return (
    <div>
      <PageHeader
        title={formatPersonName(patient)}
        description={`Expediente ${patient.chartNumber}`}
        backHref="/pacientes"
        action={
          canWrite ? (
            <Link
              href={`/agenda/nueva?patientId=${patient.id}`}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800"
            >
              Agendar cita
            </Link>
          ) : undefined
        }
      />

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/pacientes/${patient.id}?tab=${key}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === key
                ? "bg-teal-50 font-medium text-teal-800"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && (
        <section className={cardClassName}>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <Info label="Teléfono" value={patient.phone} />
            <Info label="Correo" value={patient.email} />
            <Info label="CURP" value={patient.curp} />
            <Info label="Sexo" value={patient.sex} />
            <Info label="Fecha nacimiento" value={patient.birthDate} />
            <Info label="Estatus" value={patient.status} />
            <Info label="Domicilio" value={patient.address} className="sm:col-span-2" />
            <Info label="Emergencia" value={patient.emergencyContactName} />
            <Info label="Tel. emergencia" value={patient.emergencyContactPhone} />
          </dl>
        </section>
      )}

      {tab === "expediente" && (
        canWrite ? (
          <ClinicalRecordForm patientId={patientId} record={record ?? null} />
        ) : (
          <ExpedienteReadOnly record={record} />
        )
      )}

      {tab === "citas" && (
        <ListSection
          empty="Sin citas"
          items={appointments.map((a) => ({
            id: a.id,
            title: a.startAt.toLocaleString("es-MX"),
            subtitle: `${a.statusName} · ${a.modality}`,
            href: `/agenda/${a.id}`,
          }))}
        />
      )}

      {tab === "signos" && (
        <>
          {can(session?.role, "vitals:write") && (
            <div className="mb-4">
              <Link
                href={`/triage/nuevo?patientId=${patient.id}`}
                className="text-sm text-teal-700 hover:underline"
              >
                + Capturar signos vitales
              </Link>
            </div>
          )}
          <VitalsList vitals={vitals} />
        </>
      )}

      {tab === "consultas" && (
        <ListSection
          empty="Sin consultas"
          items={consultations.map((c) => ({
            id: c.id,
            title: c.diagnosis ?? "Consulta",
            subtitle: c.consultedAt.toLocaleString("es-MX"),
            href: `/consultas/cita/${c.appointmentId}`,
          }))}
        />
      )}

      {tab === "recetas" && (
        <ListSection
          empty="Sin recetas"
          items={prescriptions.map((r) => ({
            id: r.id,
            title: `Receta #${r.id}`,
            subtitle: r.issuedAt.toLocaleString("es-MX"),
            href: `/api/prescriptions/${r.id}/pdf`,
            external: true,
          }))}
        />
      )}
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
      <dd className="font-medium text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

function ExpedienteReadOnly({
  record,
}: {
  record: {
    allergies?: string | null;
    familyHistory?: string | null;
    pathologicalHistory?: string | null;
    chronicConditions?: string | null;
    currentMedications?: string | null;
    generalNotes?: string | null;
  } | undefined;
}) {
  if (!record) return <p className="text-sm text-slate-500">Sin expediente.</p>;
  const fields = [
    ["Alergias", record.allergies],
    ["Antecedentes familiares", record.familyHistory],
    ["Antecedentes patológicos", record.pathologicalHistory],
    ["Enfermedades crónicas", record.chronicConditions],
    ["Medicamentos", record.currentMedications],
    ["Observaciones", record.generalNotes],
  ] as const;
  return (
    <section className={cardClassName}>
      <dl className="space-y-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="font-medium text-slate-700">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-600">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListSection({
  empty,
  items,
}: {
  empty: string;
  items: {
    id: number;
    title: string;
    subtitle?: string;
    href: string;
    external?: boolean;
  }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className="block px-4 py-3 hover:bg-slate-50"
          >
            <p className="font-medium text-slate-900">{item.title}</p>
            {item.subtitle && (
              <p className="text-sm text-slate-500">{item.subtitle}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function VitalsList({
  vitals,
}: {
  vitals: {
    id: number;
    recordedAt: Date;
    systolicPressure: string | null;
    diastolicPressure: string | null;
    heartRate: string | null;
    oxygenSaturation: string | null;
    temperature: string | null;
    weight: string | null;
    glucose: string | null;
    bmi: string | null;
  }[];
}) {
  if (vitals.length === 0) {
    return <p className="text-sm text-slate-500">Sin registros de triage.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">PA</th>
            <th className="px-4 py-3">FC</th>
            <th className="px-4 py-3">SpO2</th>
            <th className="px-4 py-3">Temp</th>
            <th className="px-4 py-3">Peso</th>
            <th className="px-4 py-3">IMC</th>
          </tr>
        </thead>
        <tbody>
          {vitals.map((v) => (
            <tr key={v.id} className="border-t border-slate-100">
              <td className="px-4 py-3 whitespace-nowrap">
                {v.recordedAt.toLocaleString("es-MX")}
              </td>
              <td className="px-4 py-3">
                {v.systolicPressure && v.diastolicPressure
                  ? `${v.systolicPressure}/${v.diastolicPressure}`
                  : "—"}
              </td>
              <td className="px-4 py-3">{v.heartRate ?? "—"}</td>
              <td className="px-4 py-3">{v.oxygenSaturation ?? "—"}</td>
              <td className="px-4 py-3">{v.temperature ?? "—"}</td>
              <td className="px-4 py-3">{v.weight ?? "—"}</td>
              <td className="px-4 py-3">{v.bmi ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
