import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  clinicalRecordsTable,
  patientsTable,
} from "@/lib/db/schema";
import { nextChartNumber } from "@/lib/actions/patients";
import { getActiveDoctors, getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { getActiveResponsiblePhysician } from "@/lib/kiosk/commerce";
import { findExistingPatientRecord } from "@/lib/patients/find-existing";
import { formatPersonName } from "@/lib/format/name";

async function resolveStationDoctor() {
  const responsible = await getActiveResponsiblePhysician();
  if (responsible) {
    const doctors = await getActiveDoctors();
    const doctor = doctors.find((d) => d.id === responsible.doctorId);
    if (doctor) return doctor;
  }
  const doctors = await getActiveDoctors();
  if (doctors.length === 0) return null;
  return doctors[0];
}

async function createWalkInAppointment(patientId: number, doctorId: number, notes: string) {
  const scheduledStatus = await getAppointmentStatusByCode("scheduled");
  if (!scheduledStatus) return { ok: false as const, error: "Catálogo no configurado" };

  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      patientId,
      doctorId,
      appointmentStatusId: scheduledStatus.id,
      modality: "estacion_ia",
      startAt,
      endAt,
      reason: "Atención estación virtual IA",
      notes,
    })
    .returning({ id: appointmentsTable.id, startAt: appointmentsTable.startAt });

  return { ok: true as const, appointment };
}

export async function startWalkInForExistingPatient(patientId: number) {
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId));
  if (!patient) return { ok: false as const, error: "Paciente no encontrado" };

  const doctor = await resolveStationDoctor();
  if (!doctor) return { ok: false as const, error: "No hay médicos configurados en el sistema" };

  if (patient.status === "archived") {
    await db
      .update(patientsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(patientsTable.id, patient.id));
  }

  const created = await createWalkInAppointment(
    patient.id,
    doctor.id,
    "Walk-in estación — expediente existente",
  );
  if (!created.ok) return created;

  return {
    ok: true as const,
    patientId: patient.id,
    appointmentId: created.appointment.id,
    chartNumber: patient.chartNumber,
    patientName: formatPersonName(patient),
    startAt: created.appointment.startAt.toISOString(),
    doctorName: formatPersonName(doctor),
    modality: "estacion_ia",
    reused: true as const,
  };
}

/** Completa campos vacíos del expediente existente sin pisar datos ya capturados. */
async function mergeIntoExistingPatient(
  existingId: number,
  input: {
    firstName: string;
    lastNamePaternal: string;
    lastNameMaternal?: string;
    birthDate?: string;
    sex?: string;
    phone?: string;
    email?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    kioskUsername?: string | null;
    kioskPasswordHash?: string | null;
  },
) {
  const [existing] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, existingId));
  if (!existing) return;

  await db
    .update(patientsTable)
    .set({
      firstName: existing.firstName || input.firstName,
      lastNamePaternal: existing.lastNamePaternal || input.lastNamePaternal,
      lastNameMaternal: existing.lastNameMaternal || input.lastNameMaternal?.trim() || null,
      birthDate: existing.birthDate || input.birthDate?.trim() || null,
      sex: existing.sex || input.sex?.trim() || null,
      phone: existing.phone || input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || existing.email || null,
      emergencyContactName:
        existing.emergencyContactName || input.emergencyContactName?.trim() || null,
      emergencyContactPhone:
        existing.emergencyContactPhone || input.emergencyContactPhone?.trim() || null,
      kioskUsername: existing.kioskUsername || input.kioskUsername || null,
      kioskPasswordHash: existing.kioskPasswordHash || input.kioskPasswordHash || null,
      status: existing.status === "archived" ? "active" : existing.status,
      updatedAt: new Date(),
    })
    .where(eq(patientsTable.id, existingId));
}

export async function registerKioskWalkIn(input: {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  kioskUsername?: string;
  kioskPassword?: string;
}) {
  const firstName = input.firstName?.trim();
  const lastNamePaternal = input.lastNamePaternal?.trim();
  if (!firstName || !lastNamePaternal) {
    return { ok: false as const, error: "Nombre y apellido paterno son requeridos" };
  }
  if (!input.phone?.trim()) {
    return { ok: false as const, error: "El teléfono es requerido" };
  }
  const emailNorm = input.email?.trim().toLowerCase() || "";
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return {
      ok: false as const,
      error: "El correo electrónico es obligatorio y debe ser válido",
    };
  }

  const username = input.kioskUsername?.trim().toLowerCase() || null;
  const password = input.kioskPassword?.trim() || null;
  if ((username && !password) || (!username && password)) {
    return {
      ok: false as const,
      error: "Para crear su perfil escriba usuario y contraseña juntos (mínimo 4 caracteres).",
    };
  }
  if (password && password.length < 4) {
    return { ok: false as const, error: "La contraseña debe tener al menos 4 caracteres." };
  }

  let kioskPasswordHash: string | null = null;
  if (username && password) {
    const bcrypt = await import("bcryptjs");
    kioskPasswordHash = await bcrypt.hash(password, 10);
  }

  // Candado: no crear otro expediente si ya existe por teléfono / CURP / correo / nombre+FN.
  const existing = await findExistingPatientRecord({
    phone: input.phone,
    email: emailNorm,
    firstName,
    lastNamePaternal,
    birthDate: input.birthDate,
  });

  if (existing) {
    if (username) {
      const [taken] = await db
        .select({ id: patientsTable.id })
        .from(patientsTable)
        .where(eq(patientsTable.kioskUsername, username));
      if (taken && taken.id !== existing.id) {
        return { ok: false as const, error: "Ese usuario ya existe. Elija otro nombre." };
      }
    }

    await mergeIntoExistingPatient(existing.id, {
      firstName,
      lastNamePaternal,
      lastNameMaternal: input.lastNameMaternal,
      birthDate: input.birthDate,
      sex: input.sex,
      phone: input.phone,
      email: emailNorm,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      kioskUsername: username,
      kioskPasswordHash,
    });

    const visit = await startWalkInForExistingPatient(existing.id);
    if (!visit.ok) return visit;

    return {
      ...visit,
      reused: true as const,
      kioskUsername: username || existing.kioskUsername || null,
      message:
        "Ya tenía expediente en MaindHealth. Se reutilizó el mismo y se abrió una nueva visita.",
    };
  }

  if (username) {
    const [taken] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.kioskUsername, username));
    if (taken) {
      return { ok: false as const, error: "Ese usuario ya existe. Elija otro nombre." };
    }
  }

  const doctor = await resolveStationDoctor();
  if (!doctor) return { ok: false as const, error: "No hay médicos configurados en el sistema" };

  const chartNumber = await nextChartNumber();

  const [patient] = await db
    .insert(patientsTable)
    .values({
      chartNumber,
      firstName,
      lastNamePaternal,
      lastNameMaternal: input.lastNameMaternal?.trim() || null,
      birthDate: input.birthDate?.trim() || null,
      sex: input.sex?.trim() || null,
      phone: input.phone.trim(),
      email: emailNorm,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
      kioskUsername: username,
      kioskPasswordHash,
    })
    .returning({ id: patientsTable.id, chartNumber: patientsTable.chartNumber });

  await db.insert(clinicalRecordsTable).values({ patientId: patient.id });

  const created = await createWalkInAppointment(
    patient.id,
    doctor.id,
    "Walk-in estación — paciente nuevo",
  );
  if (!created.ok) return created;

  return {
    ok: true as const,
    patientId: patient.id,
    appointmentId: created.appointment.id,
    chartNumber: patient.chartNumber,
    patientName: formatPersonName({
      firstName,
      lastNamePaternal,
      lastNameMaternal: input.lastNameMaternal,
    }),
    startAt: created.appointment.startAt.toISOString(),
    doctorName: formatPersonName(doctor),
    modality: "estacion_ia",
    kioskUsername: username,
    reused: false as const,
  };
}

/**
 * Alta mínima para teleconsulta de urgencia sin identificación previa.
 * Un solo expediente pendiente por sesión de kiosco (no multiplica “Paciente Urgencia”).
 * El médico debe completar datos reales; status = pending_identity hasta entonces.
 */
export async function ensureCrisisPlaceholderForSession(sessionId: number) {
  const phone = `crisis-s${sessionId}`;
  const existing = await findExistingPatientRecord({ phone });
  if (existing) {
    const visit = await startWalkInForExistingPatient(existing.id);
    if (!visit.ok) return visit;
    return { ...visit, reused: true as const, pendingIdentity: true as const };
  }

  const doctor = await resolveStationDoctor();
  if (!doctor) return { ok: false as const, error: "No hay médicos configurados en el sistema" };

  const chartNumber = await nextChartNumber();
  const [patient] = await db
    .insert(patientsTable)
    .values({
      chartNumber,
      firstName: "Pendiente",
      lastNamePaternal: "Identificación",
      phone,
      status: "pending_identity",
    })
    .returning({ id: patientsTable.id, chartNumber: patientsTable.chartNumber });

  await db.insert(clinicalRecordsTable).values({ patientId: patient.id });

  const created = await createWalkInAppointment(
    patient.id,
    doctor.id,
    "Walk-in estación — urgencia sin identificar (pendiente de datos)",
  );
  if (!created.ok) return created;

  return {
    ok: true as const,
    patientId: patient.id,
    appointmentId: created.appointment.id,
    chartNumber: patient.chartNumber,
    patientName: "Pendiente Identificación",
    startAt: created.appointment.startAt.toISOString(),
    doctorName: formatPersonName(doctor),
    modality: "estacion_ia",
    reused: false as const,
    pendingIdentity: true as const,
  };
}
