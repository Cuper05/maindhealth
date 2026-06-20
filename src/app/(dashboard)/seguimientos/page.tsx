import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  followUpsTable,
  patientsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName, cardClassName } from "@/lib/ui/classes";

export default async function SeguimientosPage() {
  const session = await requireSession();
  const canWrite = can(session?.role, "followups:write");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pending = await db
    .select({
      id: followUpsTable.id,
      nextReviewAt: followUpsTable.nextReviewAt,
      evolution: followUpsTable.evolution,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientId: patientsTable.id,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(followUpsTable)
    .innerJoin(patientsTable, eq(followUpsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(followUpsTable.doctorId, usersTable.id))
    .where(
      and(
        sql`${followUpsTable.nextReviewAt} IS NOT NULL`,
        gte(followUpsTable.nextReviewAt, today),
      ),
    )
    .orderBy(followUpsTable.nextReviewAt);

  const rows = await db
    .select({
      id: followUpsTable.id,
      followUpAt: followUpsTable.followUpAt,
      nextReviewAt: followUpsTable.nextReviewAt,
      evolution: followUpsTable.evolution,
      notes: followUpsTable.notes,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientId: patientsTable.id,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(followUpsTable)
    .innerJoin(patientsTable, eq(followUpsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(followUpsTable.doctorId, usersTable.id))
    .orderBy(desc(followUpsTable.followUpAt))
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Seguimiento del paciente"
        description="Evolución clínica, observaciones y próximas revisiones."
        action={
          canWrite ? (
            <Link href="/seguimientos/nuevo" className={buttonPrimaryClassName}>
              + Nuevo seguimiento
            </Link>
          ) : undefined
        }
      />

      {pending.length > 0 && (
        <section className={`${cardClassName} mb-8`}>
          <h2 className="mb-4 font-medium text-amber-900">Próximas revisiones</h2>
          <ul className="divide-y divide-slate-100">
            {pending.map((row) => (
              <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/pacientes/${row.patientId}?tab=seguimientos`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {formatPersonName({
                        firstName: row.patientFirstName,
                        lastNamePaternal: row.patientLastNamePaternal,
                        lastNameMaternal: row.patientLastNameMaternal,
                      })}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {row.chartNumber}
                    </span>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {row.evolution}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-amber-800">
                      {row.nextReviewAt?.toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="text-slate-500">
                      {formatPersonName({
                        firstName: row.doctorFirstName,
                        lastNamePaternal: row.doctorLastNamePaternal,
                        lastNameMaternal: row.doctorLastNameMaternal,
                      })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Médico</th>
              <th className="px-4 py-3 font-medium">Evolución</th>
              <th className="px-4 py-3 font-medium">Próxima revisión</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Sin seguimientos registrados.
                  {canWrite && (
                    <>
                      {" "}
                      <Link
                        href="/seguimientos/nuevo"
                        className="text-teal-700 hover:underline"
                      >
                        Registrar el primero
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.followUpAt.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/pacientes/${row.patientId}?tab=seguimientos`}
                      className="text-teal-700 hover:underline"
                    >
                      <span className="font-mono text-xs text-slate-500">
                        {row.chartNumber}
                      </span>
                      <br />
                      {formatPersonName({
                        firstName: row.patientFirstName,
                        lastNamePaternal: row.patientLastNamePaternal,
                        lastNameMaternal: row.patientLastNameMaternal,
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {formatPersonName({
                      firstName: row.doctorFirstName,
                      lastNamePaternal: row.doctorLastNamePaternal,
                      lastNameMaternal: row.doctorLastNameMaternal,
                    })}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{row.evolution ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.nextReviewAt
                      ? row.nextReviewAt.toLocaleString("es-MX")
                      : "—"}
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
