import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  stationClinicalProtocolsTable,
  stationResponsiblePhysiciansTable,
  stationServicesTable,
  usersTable,
} from "@/lib/db/schema";

/** Semilla de servicios, médico responsable y protocolos preautorizados. */
export async function seedStationCommerce() {
  const services = [
    {
      code: "consulta_general",
      name: "Consulta general en estación",
      description: "Evaluación con signos vitales, análisis IA y tratamiento según protocolo.",
      amountCents: 35000,
      sortOrder: 1,
    },
    {
      code: "seguimiento",
      name: "Seguimiento / control",
      description: "Control de evolución con signos vitales y orientación clínica.",
      amountCents: 25000,
      sortOrder: 2,
    },
    {
      code: "signos_vitales",
      name: "Toma de signos vitales",
      description: "Captura guiada de presión, SpO₂, peso, talla y temperatura.",
      amountCents: 15000,
      sortOrder: 3,
    },
  ];

  for (const service of services) {
    const [existing] = await db
      .select()
      .from(stationServicesTable)
      .where(eq(stationServicesTable.code, service.code));
    if (!existing) {
      await db.insert(stationServicesTable).values(service);
    }
  }

  const [doctor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "doctor@maindhealth.local"));
  if (!doctor) {
    console.warn("seedStationCommerce: no hay doctor@maindhealth.local");
    return;
  }

  const [responsible] = await db
    .select()
    .from(stationResponsiblePhysiciansTable)
    .where(eq(stationResponsiblePhysiciansTable.doctorId, doctor.id));
  if (!responsible) {
    await db.insert(stationResponsiblePhysiciansTable).values({
      doctorId: doctor.id,
      active: true,
      authorizationNote:
        "Autoriza el uso de sus datos profesionales para emitir recetas únicamente dentro de protocolos clínicos preautorizados de la estación MaindHealth.",
    });
  }

  const protocols = [
    {
      code: "GI_LEVE",
      name: "Molestia gastrointestinal leve",
      description: "Dispepsia / gastritis leve sin alarmas",
      keywords: [
        "dolor estomacal",
        "dolor de estomago",
        "dolor de estómago",
        "gastritis",
        "acidez",
        "nauseas",
        "náuseas",
        "indigestion",
        "indigestión",
      ],
      diagnosisLabel: "Síndrome dispéptico / molestia gastrointestinal leve",
      treatmentPlan:
        "Dieta blanda, evitar irritantes y alcohol. Medicación sintomática según protocolo autorizado.",
      instructions:
        "Si hay vómito persistente, sangre, dolor intenso o deshidratación, regresa a la estación o acude a urgencias.",
      medications: [
        {
          medication: "Omeprazol",
          dose: "20 mg",
          frequency: "Cada 24 horas en ayunas",
          duration: "7 días",
          route: "Oral",
          instructions: "Tomar 30 minutos antes del desayuno.",
        },
        {
          medication: "Paracetamol",
          dose: "500 mg",
          frequency: "Cada 8 horas si hay dolor",
          duration: "3 días",
          route: "Oral",
          instructions: "Evitar antiinflamatorios si hay molestia gástrica.",
        },
      ],
      authorizedByDoctorId: doctor.id,
    },
    {
      code: "CEFALEA_LEVE",
      name: "Cefalea tensional leve",
      description: "Dolor de cabeza sin signos neurológicos de alarma",
      keywords: ["dolor de cabeza", "cefalea", "migrana", "migraña"],
      diagnosisLabel: "Cefalea tensional leve",
      treatmentPlan: "Analgesia sintomática, hidratación y reposo relativo.",
      instructions:
        "Si el dolor es el peor de tu vida, hay confusión, debilidad o vómito en proyectil, busca atención inmediata.",
      medications: [
        {
          medication: "Paracetamol",
          dose: "500 mg",
          frequency: "Cada 8 horas si hay dolor",
          duration: "3 días",
          route: "Oral",
          instructions: "No exceder 3 g al día.",
        },
      ],
      authorizedByDoctorId: doctor.id,
    },
    {
      code: "IRA_LEVE",
      name: "Infección respiratoria alta leve",
      description: "Resfriado / faringitis sin hipoxemia",
      keywords: ["tos", "gripe", "resfriado", "congestion", "congestión", "garganta"],
      diagnosisLabel: "Infección respiratoria alta probable de manejo ambulatorio",
      treatmentPlan: "Medidas generales y alivio sintomático según protocolo.",
      instructions: "Si aparece falta de aire, fiebre persistente o dolor torácico, regresa a la estación.",
      medications: [
        {
          medication: "Paracetamol",
          dose: "500 mg",
          frequency: "Cada 8 horas si hay dolor o fiebre",
          duration: "3 días",
          route: "Oral",
          instructions: "No exceder 3 g al día.",
        },
        {
          medication: "Loratadina",
          dose: "10 mg",
          frequency: "Cada 24 horas",
          duration: "5 días",
          route: "Oral",
          instructions: "Útil si hay congestión o estornudos.",
        },
      ],
      authorizedByDoctorId: doctor.id,
    },
  ];

  for (const protocol of protocols) {
    const [existing] = await db
      .select()
      .from(stationClinicalProtocolsTable)
      .where(eq(stationClinicalProtocolsTable.code, protocol.code));
    if (!existing) {
      await db.insert(stationClinicalProtocolsTable).values(protocol);
    }
  }
}
