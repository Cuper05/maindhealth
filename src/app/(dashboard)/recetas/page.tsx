import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  patientsTable,
  prescriptionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function RecetasPage() {
  await requireSession();

  const rows = await db
    .select({
      id: prescriptionsTable.id,
      issuedAt: prescriptionsTable.issuedAt,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(prescriptionsTable)
    .innerJoin(patientsTable, eq(prescriptionsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
    .orderBy(desc(prescriptionsTable.issuedAt))
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Recetas"
        description="Recetas emitidas desde consultas. Descarga en PDF."
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Expediente</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Médico</th>
              <th className="px-4 py-3 font-medium">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Sin recetas. Emítelas desde una consulta.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.issuedAt.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.chartNumber}</td>
                  <td className="px-4 py-3">
                    {formatPersonName({
                      firstName: row.patientFirstName,
                      lastNamePaternal: row.patientLastNamePaternal,
                      lastNameMaternal: row.patientLastNameMaternal,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {formatPersonName({
                      firstName: row.doctorFirstName,
                      lastNamePaternal: row.doctorLastNamePaternal,
                      lastNameMaternal: row.doctorLastNameMaternal,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/prescriptions/${row.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-700 hover:underline"
                    >
                      Descargar
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Las recetas se crean en{" "}
        <Link href="/consultas" className="text-teal-700 hover:underline">
          Consultas
        </Link>{" "}
        al atender una cita.
      </p>
    </div>
  );
}
