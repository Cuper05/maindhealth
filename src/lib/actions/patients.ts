"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { clinicalRecordsTable, patientsTable } from "@/lib/db/schema";
import {
  parseClinicalRecordForm,
  parsePatientForm,
} from "@/lib/validators/patient";

async function nextChartNumber() {
  const [row] = await db.select({ total: count() }).from(patientsTable);
  const next = (row?.total ?? 0) + 1;
  return `MH-${String(next).padStart(4, "0")}`;
}

export async function createPatient(_prev: unknown, formData: FormData) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const chartNumber = await nextChartNumber();

  const [patient] = await db
    .insert(patientsTable)
    .values({
      chartNumber,
      firstName: data.firstName,
      lastNamePaternal: data.lastNamePaternal,
      lastNameMaternal: data.lastNameMaternal,
      birthDate: data.birthDate || null,
      sex: data.sex,
      curp: data.curp,
      phone: data.phone,
      email: data.email || null,
      address: data.address,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
    })
    .returning({ id: patientsTable.id });

  await db.insert(clinicalRecordsTable).values({
    patientId: patient.id,
    allergies: data.allergies,
    chronicConditions: data.chronicConditions,
    currentMedications: data.currentMedications,
  });

  revalidatePath("/pacientes");
  return actionSuccess({ patientId: patient.id });
}

export async function updateClinicalRecord(
  patientId: number,
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseClinicalRecordForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const [existing] = await db
    .select()
    .from(clinicalRecordsTable)
    .where(eq(clinicalRecordsTable.patientId, patientId));

  if (existing) {
    await db
      .update(clinicalRecordsTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(clinicalRecordsTable.patientId, patientId));
  } else {
    await db.insert(clinicalRecordsTable).values({
      patientId,
      ...data,
    });
  }

  revalidatePath(`/pacientes/${patientId}`);
  return actionSuccess({});
}
