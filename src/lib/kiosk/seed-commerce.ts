import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  stationClinicalProtocolsTable,
  stationResponsiblePhysiciansTable,
  stationServicesTable,
  usersTable,
} from "@/lib/db/schema";
import { STATION_PROTOCOL_DRAFTS } from "@/lib/kiosk/clinical-protocols-catalog";

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

  // Protocolo legado reemplazado
  const [legacyIra] = await db
    .select()
    .from(stationClinicalProtocolsTable)
    .where(eq(stationClinicalProtocolsTable.code, "IRA_LEVE"));
  if (legacyIra) {
    await db
      .update(stationClinicalProtocolsTable)
      .set({
        active: false,
        name: "IRA_LEVE (reemplazado por IRA_VIRAL_LEVE / FARINGITIS_BACT)",
      })
      .where(eq(stationClinicalProtocolsTable.code, "IRA_LEVE"));
  }

  for (const draft of STATION_PROTOCOL_DRAFTS) {
    const inclusionBlock = draft.inclusion.map((x) => `• ${x}`).join("\n");
    const exclusionBlock = draft.exclusion.map((x) => `• ${x}`).join("\n");
    const refs = draft.references.map((x) => `• ${x}`).join("\n");
    const description = [
      draft.description,
      "",
      "INCLUSIÓN:",
      inclusionBlock,
      "",
      "EXCLUSIÓN (→ teleconsulta):",
      exclusionBlock,
      "",
      `Severidad máxima autónoma: ${draft.maxAutonomousSeverity}`,
      "",
      "REFERENCIAS (validar por médico firmante):",
      refs,
      "",
      "ESTADO: borrador clínico asistido por IA — requiere firma del médico responsable.",
    ].join("\n");

    const row = {
      code: draft.code,
      name: draft.name,
      description,
      keywords: draft.keywords,
      medications: draft.medications,
      treatmentPlan: draft.treatmentPlan,
      instructions: draft.instructions,
      diagnosisLabel: draft.diagnosisLabel,
      authorizedByDoctorId: doctor.id,
      active: true,
    };

    const [existing] = await db
      .select()
      .from(stationClinicalProtocolsTable)
      .where(eq(stationClinicalProtocolsTable.code, draft.code));
    if (!existing) {
      await db.insert(stationClinicalProtocolsTable).values(row);
    } else {
      await db
        .update(stationClinicalProtocolsTable)
        .set({
          name: row.name,
          description: row.description,
          keywords: row.keywords,
          medications: row.medications,
          treatmentPlan: row.treatmentPlan,
          instructions: row.instructions,
          diagnosisLabel: row.diagnosisLabel,
          active: true,
        })
        .where(eq(stationClinicalProtocolsTable.code, draft.code));
    }
  }
}
