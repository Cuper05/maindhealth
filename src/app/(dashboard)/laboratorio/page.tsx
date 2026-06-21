import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { LAB_RESULT_STATUS_LABELS, type LabResultStatus } from "@/lib/db/schema/lab-results";
import { getLabResultsList, formatLabPatientName } from "@/lib/queries/lab-results";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

export default async function LaboratorioPage() {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "labs:view")) redirect("/");

  const rows = await getLabResultsList();

  return (
    <div>
      <PageHeader
        title="Laboratorio"
        description="Resultados estructurados de estudios clínicos."
        action={
          can(session.role, "labs:write") ? (
            <Link href="/laboratorio/nuevo" className={buttonPrimaryClassName}>
              + Nuevo resultado
            </Link>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Estudio</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  Sin resultados registrados.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{row.resultAt.toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3">
                    <Link href={`/pacientes/${row.patientId}?tab=expediente`} className="text-teal-700 hover:underline">
                      {row.chartNumber} — {formatLabPatientName(row)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.testName}</td>
                  <td className="px-4 py-3">
                    {LAB_RESULT_STATUS_LABELS[row.status as LabResultStatus] ?? row.status}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
