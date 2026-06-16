import { config } from "dotenv";
config({ override: true });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  clinicalRecordsTable,
  patientsTable,
  rolesTable,
  usersTable,
} from "../src/lib/db/schema";

const ROLES = [
  { code: "admin", name: "Administrador", description: "Control total" },
  { code: "doctor", name: "Médico", description: "Consultas y recetas" },
  { code: "nurse", name: "Enfermería", description: "Triage y signos vitales" },
  { code: "reception", name: "Recepción", description: "Pacientes y agenda" },
  { code: "patient", name: "Paciente", description: "Portal del paciente" },
] as const;

const APPOINTMENT_STATUSES = [
  { code: "scheduled", name: "Programada" },
  { code: "in_progress", name: "En curso" },
  { code: "completed", name: "Completada" },
  { code: "cancelled", name: "Cancelada" },
  { code: "no_show", name: "No se presentó" },
] as const;

const APPOINTMENT_TYPES = [
  { name: "Consulta general", description: "Primera vez o seguimiento general" },
  { name: "Seguimiento", description: "Control de evolución" },
  { name: "Urgencia leve", description: "Atención prioritaria no crítica" },
] as const;

async function ensureRole(db: ReturnType<typeof getDb>, code: string) {
  let [role] = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.code, code));
  if (!role) {
    const meta = ROLES.find((r) => r.code === code)!;
    [role] = await db
      .insert(rolesTable)
      .values({
        code: meta.code,
        name: meta.name,
        description: meta.description,
      })
      .returning();
  }
  return role;
}

async function main() {
  const db = getDb();
  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD ?? "admin123",
    12,
  );

  for (const role of ROLES) {
    await ensureRole(db, role.code);
  }

  for (const status of APPOINTMENT_STATUSES) {
    const [existing] = await db
      .select()
      .from(catalogAppointmentStatusesTable)
      .where(eq(catalogAppointmentStatusesTable.code, status.code));
    if (!existing) {
      await db.insert(catalogAppointmentStatusesTable).values(status);
    }
  }

  for (const type of APPOINTMENT_TYPES) {
    const [existing] = await db
      .select()
      .from(catalogAppointmentTypesTable)
      .where(eq(catalogAppointmentTypesTable.name, type.name));
    if (!existing) {
      await db.insert(catalogAppointmentTypesTable).values(type);
    }
  }

  const adminRole = await ensureRole(db, "admin");
  const doctorRole = await ensureRole(db, "doctor");
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@maindhealth.local";

  let [admin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (!admin) {
    [admin] = await db
      .insert(usersTable)
      .values({
        roleId: adminRole.id,
        firstName: "Administrador",
        lastNamePaternal: "MaindHealth",
        email: adminEmail,
        passwordHash,
      })
      .returning();
    console.log(`Admin creado: ${adminEmail}`);
  } else {
    await db
      .update(usersTable)
      .set({ passwordHash, active: true, roleId: adminRole.id })
      .where(eq(usersTable.email, adminEmail));
    console.log(`Admin actualizado: ${adminEmail}`);
  }

  let [doctorUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "doctor@maindhealth.local"));

  if (!doctorUser) {
    [doctorUser] = await db
      .insert(usersTable)
      .values({
        roleId: doctorRole.id,
        firstName: "Ana",
        lastNamePaternal: "Méndez",
        lastNameMaternal: "López",
        email: "doctor@maindhealth.local",
        passwordHash,
        specialty: "Medicina general",
        professionalLicense: "12345678",
      })
      .returning();
    console.log("Médico demo creado");
  }

  let [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.chartNumber, "MH-0001"));

  if (!patient) {
    [patient] = await db
      .insert(patientsTable)
      .values({
        chartNumber: "MH-0001",
        firstName: "Juan",
        lastNamePaternal: "Pérez",
        lastNameMaternal: "García",
        email: "paciente.demo@email.com",
        phone: "2221234567",
        curp: "PEXJ900101HDFRRN09",
        sex: "Masculino",
        status: "active",
      })
      .returning();
    console.log("Paciente demo creado");
  }

  const [existingRecord] = await db
    .select()
    .from(clinicalRecordsTable)
    .where(eq(clinicalRecordsTable.patientId, patient.id));

  if (!existingRecord) {
    await db.insert(clinicalRecordsTable).values({
      patientId: patient.id,
      allergies: "Ninguna conocida",
      chronicConditions: "Hipertensión controlada",
      currentMedications: "Losartán 50 mg c/24h",
    });
    console.log("Expediente clínico demo creado");
  }

  const [scheduledStatus] = await db
    .select()
    .from(catalogAppointmentStatusesTable)
    .where(eq(catalogAppointmentStatusesTable.code, "scheduled"));

  const [generalType] = await db
    .select()
    .from(catalogAppointmentTypesTable)
    .where(eq(catalogAppointmentTypesTable.name, "Consulta general"));

  const [existingAppt] = await db.select().from(appointmentsTable).limit(1);

  if (!existingAppt && scheduledStatus && generalType) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setMinutes(30);

    await db.insert(appointmentsTable).values({
      patientId: patient.id,
      doctorId: doctorUser.id,
      appointmentTypeId: generalType.id,
      appointmentStatusId: scheduledStatus.id,
      modality: "teleconsulta",
      startAt: tomorrow,
      endAt: end,
      reason: "Consulta general — seguimiento",
      meetingUrl: "https://meet.example.com/maindhealth-demo",
    });
    console.log("Cita demo creada");
  }

  console.log("Seed completado");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
