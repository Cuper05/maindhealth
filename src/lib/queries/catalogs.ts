import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  catalogDeviceTypesTable,
  catalogDiagnosesTable,
  catalogDocumentTypesTable,
  catalogMedicationsTable,
  catalogSymptomsTable,
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
    .where(and(eq(rolesTable.code, "doctor"), eq(usersTable.active, true)))
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

export async function getDocumentTypes() {
  return db
    .select()
    .from(catalogDocumentTypesTable)
    .where(eq(catalogDocumentTypesTable.active, true))
    .orderBy(asc(catalogDocumentTypesTable.name));
}

export async function getDeviceTypes() {
  return db
    .select()
    .from(catalogDeviceTypesTable)
    .where(eq(catalogDeviceTypesTable.active, true))
    .orderBy(asc(catalogDeviceTypesTable.name));
}

export async function getActiveSymptoms() {
  return db
    .select()
    .from(catalogSymptomsTable)
    .where(eq(catalogSymptomsTable.active, true))
    .orderBy(asc(catalogSymptomsTable.name));
}

export async function getActiveDiagnoses() {
  return db
    .select()
    .from(catalogDiagnosesTable)
    .where(eq(catalogDiagnosesTable.active, true))
    .orderBy(asc(catalogDiagnosesTable.name));
}

export async function getActiveMedications() {
  return db
    .select()
    .from(catalogMedicationsTable)
    .where(eq(catalogMedicationsTable.active, true))
    .orderBy(asc(catalogMedicationsTable.name));
}
