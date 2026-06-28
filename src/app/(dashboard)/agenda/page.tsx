import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  patientsTable,
  usersTable,
  visitIntakesTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

export default async function AgendaPage() {
  const session = await requireSession();
  const canWrite = can(session?.role, "appointments:write");

  const rows = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      statusName: catalogAppointmentStatusesTable.name,
      typeName: catalogAppointmentTypesTable.name,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
      intakeId: visitIntakesTable.id,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(
        appointmentsTable.appointmentStatusId,
        catalogAppointmentStatusesTable.id,
      ),
    )
    .leftJoin(
      catalogAppointmentTypesTable,
      eq(appointmentsTable.appointmentTypeId, catalogAppointmentTypesTable.id),
    )
    .leftJoin(visitIntakesTable, eq(visitIntakesTable.appointmentId, appointmentsTable.id))
    .orderBy(desc(appointmentsTable.startAt));

  return (
    <div>
      <PageHeader
        title="Agenda médica"
        description="Citas y teleconsultas programadas."
        action={
          canWrite ? (
            <Link href="/agenda/nueva" className={buttonPrimaryClassName}>
              + Nueva cita
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha / hora</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Médico</th>
              <th className="px-4 py-3 font-medium">Modalidad</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 font-medium">Intake</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay citas.{" "}
                  {canWrite && (
                    <Link href="/agenda/nueva" className="text-teal-700 hover:underline">
                      Agendar una
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.startAt.toLocaleString("es-MX", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
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
                  <td className="px-4 py-3 capitalize">{row.modality}</td>
                  <td className="px-4 py-3">{row.statusName}</td>
                  <td className="px-4 py-3">
                    {row.intakeId ? (
                      <span className="text-teal-700">Completo</span>
                    ) : (
                      <span className="text-amber-700">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/agenda/${row.id}`}
                      className="text-teal-700 hover:underline"
                    >
                      Ver
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
