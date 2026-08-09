import { config } from "dotenv";
config({ override: true });
config({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  catalogDeviceTypesTable,
  catalogDiagnosesTable,
  catalogDocumentTypesTable,
  catalogMedicationsTable,
  catalogSymptomsTable,
  clinicalRecordsTable,
  consultationPaymentsTable,
  deviceReadingsTable,
  labResultsTable,
  medicalDevicesTable,
  notificationsTable,
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

const DOCUMENT_TYPES = [
  { name: "Laboratorio", description: "Resultados de estudios de laboratorio" },
  { name: "Imagen / rayos X", description: "Radiografías, tomografías, ultrasonido" },
  { name: "Receta previa", description: "Recetas de otras consultas" },
  { name: "Reporte médico", description: "Informes clínicos externos" },
  { name: "Identificación", description: "INE, CURP, comprobantes" },
  { name: "Otro", description: "Documentos varios" },
] as const;

const SYMPTOMS = [
  { name: "Cefalea", category: "Neurológico", description: "Dolor de cabeza" },
  { name: "Fiebre", category: "General", description: "Temperatura elevada" },
  { name: "Tos seca", category: "Respiratorio", description: "Tos sin expectoración" },
  { name: "Dolor abdominal", category: "Digestivo", description: "Malestar en abdomen" },
  { name: "Fatiga", category: "General", description: "Cansancio persistente" },
  { name: "Mareo", category: "Neurológico", description: "Sensación de inestabilidad" },
  { name: "Náusea", category: "Digestivo", description: "Sensación de malestar gástrico" },
] as const;

const DIAGNOSES = [
  {
    code: "J06.9",
    name: "Infección aguda de vías respiratorias superiores",
    description: "Resfriado común, faringitis viral",
  },
  {
    code: "I10",
    name: "Hipertensión esencial",
    description: "Presión arterial elevada sin causa secundaria",
  },
  {
    code: "E11.9",
    name: "Diabetes mellitus tipo 2",
    description: "Control metabólico y seguimiento",
  },
  {
    code: "R51",
    name: "Cefalea",
    description: "Dolor de cabeza inespecífico",
  },
  {
    code: "K21.0",
    name: "Enfermedad por reflujo gastroesofágico",
    description: "Con esofagitis",
  },
] as const;

const MEDICATIONS = [
  {
    name: "Tylenol",
    genericName: "Paracetamol",
    form: "Tableta",
    strength: "500 mg",
    description: "Analgésico y antipirético",
  },
  {
    name: "Advil",
    genericName: "Ibuprofeno",
    form: "Tableta",
    strength: "400 mg",
    description: "Antiinflamatorio no esteroideo",
  },
  {
    name: "Cozaar",
    genericName: "Losartán",
    form: "Tableta",
    strength: "50 mg",
    description: "Antihipertensivo ARA II",
  },
  {
    name: "Glucophage",
    genericName: "Metformina",
    form: "Tableta",
    strength: "850 mg",
    description: "Antidiabético oral",
  },
  {
    name: "Losec",
    genericName: "Omeprazol",
    form: "Cápsula",
    strength: "20 mg",
    description: "Inhibidor de bomba de protones",
  },
] as const;

const DEVICE_TYPES = [
  { name: "Baumanómetro", category: "clinico", description: "Triage — presión arterial" },
  { name: "Oxímetro", category: "clinico", description: "Triage — SpO2" },
  { name: "Termómetro", category: "clinico", description: "Triage — temperatura" },
  { name: "Báscula digital", category: "clinico", description: "Triage — peso" },
  { name: "Medidor de altura", category: "clinico", description: "Triage — altura / IMC" },
  { name: "Glucómetro", category: "clinico", description: "Triage — glucosa" },
  { name: "Cámara HD", category: "tecnologico", description: "Teleconsulta" },
  { name: "Micrófono", category: "tecnologico", description: "Teleconsulta" },
  { name: "Computadora clínica", category: "tecnologico", description: "Estación de trabajo" },
  { name: "Router / red", category: "soporte", description: "Conectividad" },
  { name: "UPS", category: "soporte", description: "Respaldo eléctrico" },
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

  for (const docType of DOCUMENT_TYPES) {
    const [existing] = await db
      .select()
      .from(catalogDocumentTypesTable)
      .where(eq(catalogDocumentTypesTable.name, docType.name));
    if (!existing) {
      await db.insert(catalogDocumentTypesTable).values(docType);
    }
  }

  for (const devType of DEVICE_TYPES) {
    const [existing] = await db
      .select()
      .from(catalogDeviceTypesTable)
      .where(eq(catalogDeviceTypesTable.name, devType.name));
    if (!existing) {
      await db.insert(catalogDeviceTypesTable).values(devType);
    }
  }

  for (const symptom of SYMPTOMS) {
    const [existing] = await db
      .select()
      .from(catalogSymptomsTable)
      .where(eq(catalogSymptomsTable.name, symptom.name));
    if (!existing) {
      await db.insert(catalogSymptomsTable).values(symptom);
    }
  }

  for (const diagnosis of DIAGNOSES) {
    const [existing] = await db
      .select()
      .from(catalogDiagnosesTable)
      .where(eq(catalogDiagnosesTable.name, diagnosis.name));
    if (!existing) {
      await db.insert(catalogDiagnosesTable).values(diagnosis);
    }
  }

  for (const medication of MEDICATIONS) {
    const [existing] = await db
      .select()
      .from(catalogMedicationsTable)
      .where(eq(catalogMedicationsTable.name, medication.name));
    if (!existing) {
      await db.insert(catalogMedicationsTable).values(medication);
    }
  }

  const [oximeterType] = await db
    .select()
    .from(catalogDeviceTypesTable)
    .where(eq(catalogDeviceTypesTable.name, "Oxímetro"));
  const [existingDevice] = await db.select().from(medicalDevicesTable).limit(1);
  if (!existingDevice && oximeterType) {
    await db.insert(medicalDevicesTable).values({
      deviceTypeId: oximeterType.id,
      brand: "Omron",
      model: "Demo",
      serialNumber: "OX-DEMO-001",
      registeredAt: new Date().toISOString().slice(0, 10),
      status: "activo",
      location: "Teleconsultorio 1",
    });
    console.log("Equipo demo creado");
  }

  const adminRole = await ensureRole(db, "admin");
  const doctorRole = await ensureRole(db, "doctor");
  const patientRole = await ensureRole(db, "patient");
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

    const [appt] = await db
      .insert(appointmentsTable)
      .values({
        patientId: patient.id,
        doctorId: doctorUser.id,
        appointmentTypeId: generalType.id,
        appointmentStatusId: scheduledStatus.id,
        modality: "teleconsulta",
        startAt: tomorrow,
        endAt: end,
        reason: "Consulta general — seguimiento",
        meetingUrl: process.env.DAILY_DOMAIN
          ? `https://${process.env.DAILY_DOMAIN}.daily.co/maindhealth-demo`
          : "https://maindhealth.daily.co/demo-consulta",
        meetingRoomName: "maindhealth-demo",
      })
      .returning({ id: appointmentsTable.id });

    await db.insert(consultationPaymentsTable).values({
      appointmentId: appt.id,
      patientId: patient.id,
      amountCents: 35000,
      method: "pending",
      status: "pending",
      notes: "Consulta general telemedicina",
    });

    console.log("Cita demo creada");
  }

  let [patientUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "paciente@maindhealth.local"));

  if (!patientUser) {
    [patientUser] = await db
      .insert(usersTable)
      .values({
        roleId: patientRole.id,
        patientId: patient.id,
        firstName: patient.firstName,
        lastNamePaternal: patient.lastNamePaternal,
        lastNameMaternal: patient.lastNameMaternal,
        email: "paciente@maindhealth.local",
        passwordHash,
      })
      .returning();
    console.log("Usuario paciente demo creado: paciente@maindhealth.local");
  } else {
    await db
      .update(usersTable)
      .set({ patientId: patient.id, roleId: patientRole.id, passwordHash, active: true })
      .where(eq(usersTable.email, "paciente@maindhealth.local"));
  }

  const [demoDevice] = await db.select().from(medicalDevicesTable).limit(1);
  const [existingReading] = await db.select().from(deviceReadingsTable).limit(1);
  if (demoDevice && !existingReading) {
    await db.insert(deviceReadingsTable).values({
      medicalDeviceId: demoDevice.id,
      patientId: patient.id,
      systolicPressure: "128",
      diastolicPressure: "82",
      heartRate: "74",
      oxygenSaturation: "97",
      source: "device",
      notes: "Lectura demo oxímetro",
    });
    console.log("Lectura de dispositivo demo creada");
  }

  const [existingLab] = await db.select().from(labResultsTable).limit(1);
  if (!existingLab) {
    await db.insert(labResultsTable).values({
      patientId: patient.id,
      testName: "Biometría hemática",
      testCode: "BH-DEMO",
      results: {
        hemoglobina: "14.1 g/dL",
        leucocitos: "6.2 x10³/µL",
        plaquetas: "245 x10³/µL",
      },
      status: "completed",
      uploadedById: doctorUser.id,
    });
    console.log("Resultado de laboratorio demo creado");
  }

  const [demoAppt] = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.patientId, patient.id))
    .limit(1);
  const [existingPayment] = await db.select().from(consultationPaymentsTable).limit(1);
  if (demoAppt && !existingPayment) {
    await db.insert(consultationPaymentsTable).values({
      appointmentId: demoAppt.id,
      patientId: patient.id,
      amountCents: 35000,
      method: "pending",
      status: "pending",
      notes: "Consulta general telemedicina",
    });
    console.log("Pago demo creado");
  }

  for (const user of [admin, doctorUser, patientUser]) {
    const [existingWelcome] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.referenceKey, `sistema:bienvenida:${user.id}`));
    if (!existingWelcome) {
      await db.insert(notificationsTable).values({
        userId: user.id,
        type: "sistema",
        title: "Bienvenido a MaindHealth",
        body: "Aquí verás recordatorios de citas, seguimientos y triage.",
        href: user === patientUser ? "/portal" : "/notificaciones",
        referenceKey: `sistema:bienvenida:${user.id}`,
      });
    }
  }

  console.log("Seed completado");
  const { seedStationCommerce } = await import("../src/lib/kiosk/seed-commerce");
  await seedStationCommerce();
  console.log("Comercio de estación (servicios, médico responsable, protocolos) listo");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
