import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  patientsTable,
  rolesTable,
  usersTable,
} from "@/lib/db/schema";

export async function getActivePatients() {
  return db
    .select({
      id: patientsTable.id,
      chartNumber: patientsTable.chartNumber,
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(patientsTable)
    .where(eq(patientsTable.status, "active"))
    .orderBy(asc(patientsTable.lastNamePaternal), asc(patientsTable.firstName));
}

export async function getActiveDoctors() {
  return db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastNamePaternal: usersTable.lastNamePaternal,
      lastNameMaternal: usersTable.lastNameMaternal,
      specialty: usersTable.specialty,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(rolesTable.code, "doctor"))
    .orderBy(asc(usersTable.lastNamePaternal), asc(usersTable.firstName));
}

export async function getAppointmentTypes() {
  return db
    .select()
    .from(catalogAppointmentTypesTable)
    .where(eq(catalogAppointmentTypesTable.active, true))
    .orderBy(asc(catalogAppointmentTypesTable.name));
}

export async function getAppointmentStatusByCode(code: string) {
  const [status] = await db
    .select()
    .from(catalogAppointmentStatusesTable)
    .where(eq(catalogAppointmentStatusesTable.code, code));
  return status;
}
