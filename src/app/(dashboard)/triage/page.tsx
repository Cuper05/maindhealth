import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { patientsTable, vitalSignsTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

export default async function TriagePage() {
  const session = await requireSession();
  const canWrite = can(session?.role, "vitals:write");

  const rows = await db
    .select({
      id: vitalSignsTable.id,
      patientId: patientsTable.id,
      recordedAt: vitalSignsTable.recordedAt,
      systolicPressure: vitalSignsTable.systolicPressure,
      diastolicPressure: vitalSignsTable.diastolicPressure,
      heartRate: vitalSignsTable.heartRate,
      oxygenSaturation: vitalSignsTable.oxygenSaturation,
      temperature: vitalSignsTable.temperature,
      weight: vitalSignsTable.weight,
      bmi: vitalSignsTable.bmi,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      chartNumber: patientsTable.chartNumber,
    })
    .from(vitalSignsTable)
    .innerJoin(patientsTable, eq(vitalSignsTable.patientId, patientsTable.id))
    .orderBy(desc(vitalSignsTable.recordedAt))
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Triage y signos vitales"
        description="Captura de presión, temperatura, saturación, peso, altura y glucosa."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/triage/historial"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Historial gráfico
            </Link>
            {canWrite ? (
              <Link href="/triage/nuevo" className={buttonPrimaryClassName}>
                + Capturar signos
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">PA</th>
              <th className="px-4 py-3 font-medium">FC</th>
              <th className="px-4 py-3 font-medium">SpO2</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">IMC</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Sin registros de triage.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.recordedAt.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/triage/historial?patientId=${row.patientId}`}
                      className="text-teal-700 hover:underline"
                    >
                      <span className="font-mono text-xs text-slate-500">{row.chartNumber}</span>
                      <br />
                      {formatPersonName({
                        firstName: row.patientFirstName,
                        lastNamePaternal: row.patientLastNamePaternal,
                        lastNameMaternal: row.patientLastNameMaternal,
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {row.systolicPressure && row.diastolicPressure
                      ? `${row.systolicPressure}/${row.diastolicPressure}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{row.heartRate ?? "—"}</td>
                  <td className="px-4 py-3">{row.oxygenSaturation ?? "—"}</td>
                  <td className="px-4 py-3">{row.temperature ?? "—"}</td>
                  <td className="px-4 py-3">{row.bmi ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
