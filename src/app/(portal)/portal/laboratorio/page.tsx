import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import { LAB_RESULT_STATUS_LABELS, type LabResultStatus } from "@/lib/db/schema/lab-results";
import { getPortalLabResults } from "@/lib/queries/portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalLaboratorioPage() {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

  const results = await getPortalLabResults(patientId);

  return (
    <div>
      <PageHeader title="Resultados de laboratorio" description="Estudios clínicos registrados." />
      <div className="space-y-4">
        {results.length === 0 ? (
          <p className="text-sm text-slate-500">Sin resultados.</p>
        ) : (
          results.map((row) => (
            <article key={row.id} className={cardClassName}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{row.testName}</p>
                  <p className="text-sm text-slate-600">
                    {row.resultAt.toLocaleString("es-MX")}
                    {row.testCode ? ` · ${row.testCode}` : ""}
                  </p>
                </div>
                <span className="text-sm text-slate-600">
                  {LAB_RESULT_STATUS_LABELS[row.status as LabResultStatus] ?? row.status}
                </span>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(row.results, null, 2)}
              </pre>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
