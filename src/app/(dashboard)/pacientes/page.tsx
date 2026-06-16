import Link from "next/link";
import { asc } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { patientsTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

export default async function PacientesPage() {
  const session = await requireSession();
  const canWrite = can(session?.role, "patients:write");

  const patients = await db
    .select()
    .from(patientsTable)
    .orderBy(asc(patientsTable.lastNamePaternal), asc(patientsTable.firstName));

  return (
    <div>
      <PageHeader
        title="Pacientes"
        description="Registro y control de pacientes del teleconsultorio."
        action={
          canWrite ? (
            <Link href="/pacientes/nuevo" className={buttonPrimaryClassName}>
              + Nuevo paciente
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Expediente</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Sin pacientes registrados.{" "}
                  {canWrite && (
                    <Link href="/pacientes/nuevo" className="text-teal-700 hover:underline">
                      Registrar el primero
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/pacientes/${p.id}`} className="text-teal-700 hover:underline">
                      {p.chartNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/pacientes/${p.id}`} className="hover:text-teal-800">
                      {formatPersonName(p)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.phone ?? "—"}</td>
                  <td className="px-4 py-3">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{p.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
