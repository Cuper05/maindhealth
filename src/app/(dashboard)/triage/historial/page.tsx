import Link from "next/link";
import { notFound } from "next/navigation";
import { VitalSignsCharts } from "@/components/vitals/VitalSignsCharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { patientsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatPersonName } from "@/lib/format/name";
import {
  getPatientVitalsHistory,
  getPatientVitalsRecent,
  getPatientsWithVitals,
} from "@/lib/queries/vital-signs";
import { cardClassName } from "@/lib/ui/classes";

export default async function TriageHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session?.role, "vitals:view")) notFound();

  const { patientId: patientIdParam } = await searchParams;
  const patientsWithVitals = await getPatientsWithVitals();

  if (!patientIdParam) {
    return (
      <div>
        <PageHeader
          title="Historial gráfico de signos vitales"
          description="Selecciona un paciente para ver la evolución de sus signos."
          backHref="/triage"
        />
        {patientsWithVitals.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aún no hay registros de triage para graficar.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {patientsWithVitals.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={`/triage/historial?patientId=${patient.id}`}
                  className="block px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-slate-500">{patient.chartNumber}</span>
                  <p className="font-medium text-slate-900">{formatPersonName(patient)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const patientId = Number(patientIdParam);
  if (!Number.isFinite(patientId)) notFound();

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId));

  if (!patient) notFound();

  const [chartRecords, recentRecords] = await Promise.all([
    getPatientVitalsHistory(patientId),
    getPatientVitalsRecent(patientId),
  ]);

  return (
    <div>
      <PageHeader
        title={`Historial — ${formatPersonName(patient)}`}
        description={`Expediente ${patient.chartNumber} · evolución de signos vitales`}
        backHref="/triage/historial"
        action={
          <Link
            href={`/pacientes/${patient.id}?tab=signos`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Ver expediente
          </Link>
        }
      />

      <VitalSignsCharts records={chartRecords} />

      <section className={cardClassName}>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Registros recientes</h2>
        <VitalsTable records={recentRecords} />
      </section>
    </div>
  );
}

function VitalsTable({
  records,
}: {
  records: {
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
  if (records.length === 0) {
    return <p className="text-sm text-slate-500">Sin registros de triage.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">PA</th>
            <th className="px-4 py-3">FC</th>
            <th className="px-4 py-3">SpO2</th>
            <th className="px-4 py-3">Temp</th>
            <th className="px-4 py-3">Peso</th>
            <th className="px-4 py-3">Glucosa</th>
            <th className="px-4 py-3">IMC</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-t border-slate-100">
              <td className="px-4 py-3 whitespace-nowrap">
                {record.recordedAt.toLocaleString("es-MX")}
              </td>
              <td className="px-4 py-3">
                {record.systolicPressure && record.diastolicPressure
                  ? `${record.systolicPressure}/${record.diastolicPressure}`
                  : "—"}
              </td>
              <td className="px-4 py-3">{record.heartRate ?? "—"}</td>
              <td className="px-4 py-3">{record.oxygenSaturation ?? "—"}</td>
              <td className="px-4 py-3">{record.temperature ?? "—"}</td>
              <td className="px-4 py-3">{record.weight ?? "—"}</td>
              <td className="px-4 py-3">{record.glucose ?? "—"}</td>
              <td className="px-4 py-3">{record.bmi ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
