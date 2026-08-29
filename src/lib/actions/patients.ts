"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  clinicalAlertsTable,
  clinicalDocumentsTable,
  clinicalMessagesTable,
  clinicalRecordsTable,
  consultationPaymentsTable,
  consultationsTable,
  deviceReadingsTable,
  digitalSignaturesTable,
  followUpsTable,
  labResultsTable,
  patientsTable,
  prescriptionsTable,
  stationKioskSessionsTable,
  stationPaymentOrdersTable,
  teleconsultaAlertAttemptsTable,
  teleconsultaEscalationsTable,
  teleconsultaJoinTokensTable,
  usersTable,
  visitIntakesTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { findExistingPatientRecord } from "@/lib/patients/find-existing";
import {
  parseClinicalRecordForm,
  parsePatientForm,
} from "@/lib/validators/patient";

export async function nextChartNumber() {
  const rows = await db
    .select({ chartNumber: patientsTable.chartNumber })
    .from(patientsTable);

  let maxN = 0;
  for (const row of rows) {
    const match = /^MH-(\d+)$/i.exec(row.chartNumber.trim());
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
  }

  // Evita colisiones si hubo borrados o altas concurrentes.
  for (let attempt = 1; attempt <= 25; attempt++) {
    const candidate = `MH-${String(maxN + attempt).padStart(4, "0")}`;
    const [exists] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.chartNumber, candidate))
      .limit(1);
    if (!exists) return candidate;
  }

  return `MH-${Date.now().toString().slice(-8)}`;
}

export async function createPatient(_prev: unknown, formData: FormData) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const duplicate = await findExistingPatientRecord({
    phone: data.phone,
    email: data.email,
    curp: data.curp,
    firstName: data.firstName,
    lastNamePaternal: data.lastNamePaternal,
    birthDate: data.birthDate,
  });
  if (duplicate) {
    return actionError(
      `Ya existe un expediente (${duplicate.chartNumber}). Ábralo en lugar de crear uno nuevo.`,
    );
  }

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

  await logActivity({
    userId: session.userId,
    module: "pacientes",
    action: "crear",
    recordId: patient.id,
    detail: `Paciente ${chartNumber}`,
  });

  revalidatePath("/pacientes");
  return actionSuccess({ patientId: patient.id });
}

export async function updatePatientDemographics(
  patientId: number,
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const [existing] = await db
    .select({ id: patientsTable.id, status: patientsTable.status })
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  if (!existing) return actionError("Paciente no encontrado");

  const duplicate = await findExistingPatientRecord({
    phone: data.phone,
    email: data.email,
    curp: data.curp,
    firstName: data.firstName,
    lastNamePaternal: data.lastNamePaternal,
    birthDate: data.birthDate,
    excludeId: patientId,
  });
  if (duplicate) {
    return actionError(
      `Esos datos coinciden con otro expediente (${duplicate.chartNumber}). Revise teléfono, CURP o correo.`,
    );
  }

  const looksLikePlaceholder =
    (data.firstName === "Paciente" && data.lastNamePaternal === "Urgencia") ||
    (data.firstName === "Pendiente" && data.lastNamePaternal === "Identificación");
  if (looksLikePlaceholder) {
    return actionError("Indique el nombre real del paciente (no el marcador de urgencia).");
  }

  const nextStatus =
    existing.status === "pending_identity" || existing.status === "archived"
      ? "active"
      : existing.status;

  await db
    .update(patientsTable)
    .set({
      firstName: data.firstName,
      lastNamePaternal: data.lastNamePaternal,
      lastNameMaternal: data.lastNameMaternal || null,
      birthDate: data.birthDate || null,
      sex: data.sex || null,
      curp: data.curp || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(patientsTable.id, patientId));

  // Antecedentes básicos del formulario de alta (si vienen).
  if (data.allergies || data.chronicConditions || data.currentMedications) {
    const [record] = await db
      .select({ id: clinicalRecordsTable.id })
      .from(clinicalRecordsTable)
      .where(eq(clinicalRecordsTable.patientId, patientId))
      .limit(1);

    if (record) {
      await db
        .update(clinicalRecordsTable)
        .set({
          allergies: data.allergies || null,
          chronicConditions: data.chronicConditions || null,
          currentMedications: data.currentMedications || null,
          updatedAt: new Date(),
        })
        .where(eq(clinicalRecordsTable.patientId, patientId));
    } else {
      await db.insert(clinicalRecordsTable).values({
        patientId,
        allergies: data.allergies || null,
        chronicConditions: data.chronicConditions || null,
        currentMedications: data.currentMedications || null,
      });
    }
  }

  await logActivity({
    userId: session.userId,
    module: "pacientes",
    action: "actualizar",
    recordId: patientId,
    detail: "Alta/completado demográfico (urgencia u edición)",
  });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/pacientes");
  revalidatePath("/consultas");
  revalidatePath(`/consultas/cita/${formData.get("appointmentId") || ""}`);
  return actionSuccess({});
}

/** Usuario y contraseña de reingreso en el kiosco. */
export async function updatePatientKioskCredentials(
  patientId: number,
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const username = String(formData.get("kioskUsername") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("kioskPassword") ?? "");
  const clearCredentials = formData.get("clearCredentials") === "on";

  const [existing] = await db
    .select({
      id: patientsTable.id,
      kioskUsername: patientsTable.kioskUsername,
      kioskPasswordHash: patientsTable.kioskPasswordHash,
    })
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  if (!existing) return actionError("Paciente no encontrado");

  if (clearCredentials) {
    await db
      .update(patientsTable)
      .set({
        kioskUsername: null,
        kioskPasswordHash: null,
        updatedAt: new Date(),
      })
      .where(eq(patientsTable.id, patientId));

    await logActivity({
      userId: session.userId,
      module: "pacientes",
      action: "actualizar",
      recordId: patientId,
      detail: "Eliminó usuario/contraseña de kiosco",
    });
    revalidatePath(`/pacientes/${patientId}`);
    return actionSuccess({});
  }

  if (!username || username.length < 3) {
    return actionError("El usuario debe tener al menos 3 caracteres.");
  }

  const [taken] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(eq(patientsTable.kioskUsername, username))
    .limit(1);
  if (taken && taken.id !== patientId) {
    return actionError("Ese usuario ya está en uso. Elija otro.");
  }

  // Contraseña nueva solo si la escriben; si deja vacío y ya tenía, conserva el hash.
  let kioskPasswordHash = existing.kioskPasswordHash;
  if (password.length > 0) {
    if (password.length < 4) {
      return actionError("La contraseña debe tener al menos 4 caracteres.");
    }
    const bcrypt = await import("bcryptjs");
    kioskPasswordHash = await bcrypt.hash(password, 10);
  } else if (!existing.kioskPasswordHash) {
    return actionError("Indique una contraseña (mínimo 4 caracteres).");
  }

  await db
    .update(patientsTable)
    .set({
      kioskUsername: username,
      kioskPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(patientsTable.id, patientId));

  await logActivity({
    userId: session.userId,
    module: "pacientes",
    action: "actualizar",
    recordId: patientId,
    detail: `Actualizó acceso kiosco (${username})`,
  });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/pacientes");
  return actionSuccess({});
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

  await logActivity({
    userId: session.userId,
    module: "expediente",
    action: "actualizar",
    recordId: patientId,
  });

  revalidatePath(`/pacientes/${patientId}`);
  return actionSuccess({});
}

export async function archivePatient(patientId: number) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const [patient] = await db
    .select({ id: patientsTable.id, chartNumber: patientsTable.chartNumber, status: patientsTable.status })
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  if (!patient) return actionError("Paciente no encontrado");
  if (patient.status === "archived") return actionError("El paciente ya está archivado");

  await db
    .update(patientsTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(patientsTable.id, patientId));

  await logActivity({
    userId: session.userId,
    module: "pacientes",
    action: "archivar",
    recordId: patientId,
    detail: `Archivado ${patient.chartNumber}`,
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientId}`);
  return actionSuccess({});
}

export async function reactivatePatient(patientId: number) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const [patient] = await db
    .select({ id: patientsTable.id, chartNumber: patientsTable.chartNumber })
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  if (!patient) return actionError("Paciente no encontrado");

  await db
    .update(patientsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(patientsTable.id, patientId));

  await logActivity({
    userId: session.userId,
    module: "pacientes",
    action: "reactivar",
    recordId: patientId,
    detail: `Reactivado ${patient.chartNumber}`,
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientId}`);
  return actionSuccess({});
}

/**
 * Borrado definitivo: elimina expediente y dependencias (citas, recetas, etc.).
 * Solo admin.
 */
export async function deletePatientPermanent(patientId: number) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);
  if (session.role !== "admin") {
    return actionError("Solo un administrador puede borrar pacientes de forma definitiva");
  }

  const [patient] = await db
    .select({ id: patientsTable.id, chartNumber: patientsTable.chartNumber })
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  if (!patient) return actionError("Paciente no encontrado");

  try {
    await db.transaction(async (tx) => {
      const appointments = await tx
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.patientId, patientId));
      const appointmentIds = appointments.map((a) => a.id);

      const consultations = await tx
        .select({ id: consultationsTable.id })
        .from(consultationsTable)
        .where(eq(consultationsTable.patientId, patientId));
      const consultationIds = consultations.map((c) => c.id);

      const prescriptions = await tx
        .select({ id: prescriptionsTable.id })
        .from(prescriptionsTable)
        .where(eq(prescriptionsTable.patientId, patientId));
      const prescriptionIds = prescriptions.map((p) => p.id);

      const vitals = await tx
        .select({ id: vitalSignsTable.id })
        .from(vitalSignsTable)
        .where(eq(vitalSignsTable.patientId, patientId));
      const vitalIds = vitals.map((v) => v.id);

      const sessions = await tx
        .select({ id: stationKioskSessionsTable.id })
        .from(stationKioskSessionsTable)
        .where(eq(stationKioskSessionsTable.patientId, patientId));
      const sessionIds = sessions.map((s) => s.id);

      if (appointmentIds.length > 0) {
        await tx
          .delete(teleconsultaAlertAttemptsTable)
          .where(inArray(teleconsultaAlertAttemptsTable.appointmentId, appointmentIds));
        await tx
          .delete(teleconsultaEscalationsTable)
          .where(inArray(teleconsultaEscalationsTable.appointmentId, appointmentIds));
        await tx
          .delete(teleconsultaJoinTokensTable)
          .where(inArray(teleconsultaJoinTokensTable.appointmentId, appointmentIds));
      }

      if (sessionIds.length > 0) {
        await tx
          .delete(stationPaymentOrdersTable)
          .where(inArray(stationPaymentOrdersTable.sessionId, sessionIds));
      }

      if (prescriptionIds.length > 0) {
        await tx
          .delete(digitalSignaturesTable)
          .where(
            and(
              eq(digitalSignaturesTable.entityType, "prescription"),
              inArray(digitalSignaturesTable.entityId, prescriptionIds),
            ),
          );
        await tx.delete(prescriptionsTable).where(inArray(prescriptionsTable.id, prescriptionIds));
      }

      if (consultationIds.length > 0) {
        await tx
          .delete(digitalSignaturesTable)
          .where(
            and(
              eq(digitalSignaturesTable.entityType, "consultation"),
              inArray(digitalSignaturesTable.entityId, consultationIds),
            ),
          );
      }

      await tx.delete(followUpsTable).where(eq(followUpsTable.patientId, patientId));
      await tx.delete(clinicalDocumentsTable).where(eq(clinicalDocumentsTable.patientId, patientId));
      await tx.delete(labResultsTable).where(eq(labResultsTable.patientId, patientId));
      await tx.delete(clinicalAlertsTable).where(eq(clinicalAlertsTable.patientId, patientId));
      await tx.delete(deviceReadingsTable).where(eq(deviceReadingsTable.patientId, patientId));

      if (vitalIds.length > 0) {
        await tx
          .update(stationKioskSessionsTable)
          .set({ vitalSignId: null })
          .where(inArray(stationKioskSessionsTable.vitalSignId, vitalIds));
      }

      await tx
        .delete(stationKioskSessionsTable)
        .where(eq(stationKioskSessionsTable.patientId, patientId));
      await tx.delete(consultationsTable).where(eq(consultationsTable.patientId, patientId));
      await tx.delete(visitIntakesTable).where(eq(visitIntakesTable.patientId, patientId));
      await tx
        .delete(consultationPaymentsTable)
        .where(eq(consultationPaymentsTable.patientId, patientId));
      await tx.delete(vitalSignsTable).where(eq(vitalSignsTable.patientId, patientId));
      await tx.delete(appointmentsTable).where(eq(appointmentsTable.patientId, patientId));
      await tx.delete(clinicalMessagesTable).where(eq(clinicalMessagesTable.patientId, patientId));
      await tx.delete(clinicalRecordsTable).where(eq(clinicalRecordsTable.patientId, patientId));

      await tx
        .update(usersTable)
        .set({ patientId: null })
        .where(eq(usersTable.patientId, patientId));

      await tx.delete(patientsTable).where(eq(patientsTable.id, patientId));
    });
  } catch (err) {
    console.error("[deletePatientPermanent]", err);
    return actionError(
      "No se pudo borrar el paciente (hay datos relacionados). Intente archivar o revise el servidor.",
    );
  }

  await logActivity({
    userId: session.userId,
    module: "pacientes",
    action: "borrar",
    recordId: patientId,
    detail: `Borrado definitivo ${patient.chartNumber}`,
  });

  revalidatePath("/pacientes");
  return actionSuccess({});
}
