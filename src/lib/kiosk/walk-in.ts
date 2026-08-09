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
  };
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
}) {
  const firstName = input.firstName?.trim();
  const lastNamePaternal = input.lastNamePaternal?.trim();
  if (!firstName || !lastNamePaternal) {
    return { ok: false as const, error: "Nombre y apellido paterno son requeridos" };
  }
  if (!input.phone?.trim()) {
    return { ok: false as const, error: "El teléfono es requerido" };
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
      email: input.email?.trim() || null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
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
  };
}
