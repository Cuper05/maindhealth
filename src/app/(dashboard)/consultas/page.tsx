import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  consultationsTable,
  patientsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ConsultasPage() {
  await requireSession();

  const rows = await db
    .select({
      id: consultationsTable.id,
      appointmentId: consultationsTable.appointmentId,
      diagnosis: consultationsTable.diagnosis,
      consultedAt: consultationsTable.consultedAt,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(consultationsTable)
    .innerJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(consultationsTable.doctorId, usersTable.id))
    .orderBy(desc(consultationsTable.consultedAt))
    .limit(50);

  const pendingAppointments = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      reason: appointmentsTable.reason,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .orderBy(desc(appointmentsTable.startAt))
    .limit(10);

  return (
    <div>
      <PageHeader
        title="Consultas"
        description="Notas médicas y teleconsultas documentadas."
      />

      {pendingAppointments.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <h2 className="text-sm font-medium text-amber-900">Citas recientes</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pendingAppointments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/consultas/cita/${a.id}`}
                  className="text-teal-800 hover:underline"
                >
                  {a.startAt.toLocaleString("es-MX")} —{" "}
                  {formatPersonName({
                    firstName: a.patientFirstName,
                    lastNamePaternal: a.patientLastNamePaternal,
                    lastNameMaternal: a.patientLastNameMaternal,
                  })}
                </Link>
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
              <th className="px-4 py-3 font-medium">Diagnóstico</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Sin consultas registradas.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.consultedAt.toLocaleString("es-MX")}
                  </td>
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
                  <td className="px-4 py-3">{row.diagnosis ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/consultas/cita/${row.appointmentId}`}
                      className="text-teal-700 hover:underline"
                    >
                      Abrir
                    </Link>
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
