import Link from "next/link";
import { and, asc, eq, ne, or } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { patientsTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await requireSession();
  const canWrite = can(session?.role, "patients:write");
  const { estado } = await searchParams;
  const showArchived = estado === "archivados";
  const showPending = estado === "pendientes";
  const showAll = estado === "todos";

  const patients = await db
    .select()
    .from(patientsTable)
    .where(
      showAll
        ? undefined
        : showArchived
          ? eq(patientsTable.status, "archived")
          : showPending
            ? or(
                eq(patientsTable.status, "pending_identity"),
                and(
                  eq(patientsTable.firstName, "Paciente"),
                  eq(patientsTable.lastNamePaternal, "Urgencia"),
                ),
                and(
                  eq(patientsTable.firstName, "Pendiente"),
                  eq(patientsTable.lastNamePaternal, "Identificación"),
                ),
              )
            : and(
                ne(patientsTable.status, "archived"),
                ne(patientsTable.status, "pending_identity"),
                // Oculta placeholders de urgencia sin datos reales.
                or(
                  ne(patientsTable.firstName, "Paciente"),
                  ne(patientsTable.lastNamePaternal, "Urgencia"),
                ),
                or(
                  ne(patientsTable.firstName, "Pendiente"),
                  ne(patientsTable.lastNamePaternal, "Identificación"),
                ),
              ),
    )
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

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/pacientes"
          className={`rounded-lg px-3 py-1.5 ${!showArchived && !showAll && !showPending ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Activos
        </Link>
        <Link
          href="/pacientes?estado=pendientes"
          className={`rounded-lg px-3 py-1.5 ${showPending ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Pendientes ID
        </Link>
        <Link
          href="/pacientes?estado=archivados"
          className={`rounded-lg px-3 py-1.5 ${showArchived ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Archivados
        </Link>
        <Link
          href="/pacientes?estado=todos"
          className={`rounded-lg px-3 py-1.5 ${showAll ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Todos
        </Link>
      </div>

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
                  Sin pacientes en esta vista.{" "}
                  {canWrite && !showArchived && !showPending && (
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
