import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncClinicalAlertsFromVitals } from "@/lib/alerts/sync-from-vitals";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  consultationsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  stationKioskSessionsTable,
  vitalSignsTable,
  type KioskAssessmentDraft,
} from "@/lib/db/schema";
import {
  assessClinicalCase,
  normalizeAssessmentText,
  type ClinicalAssessment,
} from "@/lib/kiosk/ai-assessment";
import { getActiveResponsiblePhysician } from "@/lib/kiosk/commerce";
import { notifyDoctorsStationTeleconsulta } from "@/lib/kiosk/notify-escalation";
import { isVitalsComplete } from "@/lib/kiosk/vitals";
import { buildPrescriptionFolio } from "@/lib/prescriptions/folio";
import { getActiveDoctors, getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { createDailyRoom } from "@/lib/video/daily";
import { computeBmi } from "@/lib/validators/vitals";

type ClinicalDraft = {
  chiefComplaint?: string;
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
  hasAsthma?: boolean;
  hasHeartDisease?: boolean;
  hasAllergies?: boolean;
  allergyDetails?: string;
  currentMedications?: string;
  consentSignerName?: string;
};

export async function completeKioskVisit(sessionToken: string) {
  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, sessionToken));

  if (!session?.patientId || !session.appointmentId) {
    return { ok: false as const, error: "Paciente o visita no definidos" };
  }
  if (session.paymentStatus !== "approved") {
    return { ok: false as const, error: "El pago debe estar aprobado antes del análisis clínico" };
  }

  const draft = session.vitalsDraft ?? {};
  if (!isVitalsComplete(draft)) {
    return { ok: false as const, error: "Signos vitales incompletos" };
  }

  const clinical = (session.clinicalDraft ?? {}) as ClinicalDraft;
  if (!clinical.chiefComplaint || clinical.chiefComplaint.trim().length < 3) {
    return { ok: false as const, error: "Falta el motivo de consulta" };
  }

  let vitalSignId = session.vitalSignId;
  if (!vitalSignId) {
    let bmi: string | null = draft.bmi ?? null;
    if (!bmi && draft.weight && draft.height) {
      const computed = computeBmi(Number(draft.weight), Number(draft.height));
      if (computed != null) bmi = String(computed);
    }

    const [record] = await db
      .insert(vitalSignsTable)
      .values({
        patientId: session.patientId,
        appointmentId: session.appointmentId,
        systolicPressure: draft.systolicPressure,
        diastolicPressure: draft.diastolicPressure,
        heartRate: draft.heartRate,
        oxygenSaturation: draft.oxygenSaturation,
        temperature: draft.temperature,
        weight: draft.weight,
        height: draft.height,
        bmi,
        symptoms: clinical.chiefComplaint,
      })
      .returning({ id: vitalSignsTable.id });

    vitalSignId = record.id;
    await syncClinicalAlertsFromVitals({
      patientId: session.patientId,
      vitalSignId: record.id,
      systolicPressure: draft.systolicPressure,
      diastolicPressure: draft.diastolicPressure,
      heartRate: draft.heartRate,
      oxygenSaturation: draft.oxygenSaturation,
      temperature: draft.temperature,
      source: "kiosk",
    });
  }

  const assessment = await assessClinicalCase({
    chiefComplaint: clinical.chiefComplaint,
    hasDiabetes: Boolean(clinical.hasDiabetes),
    hasHypertension: Boolean(clinical.hasHypertension),
    hasAsthma: Boolean(clinical.hasAsthma),
    hasHeartDisease: Boolean(clinical.hasHeartDisease),
    hasAllergies: Boolean(clinical.hasAllergies),
    allergyDetails: clinical.allergyDetails,
    currentMedications: clinical.currentMedications,
    vitals: draft,
  });

  const responsible = await getActiveResponsiblePhysician();
  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, session.appointmentId));

  if (!appointment) {
    return { ok: false as const, error: "Visita no encontrada" };
  }

  const doctorId = responsible?.doctorId ?? appointment.doctorId;

  if (assessment.requiresDoctor || !assessment.prescriptionAuthorized) {
    return escalateToDoctor({
      sessionToken,
      appointment,
      vitalSignId,
      assessment,
      responsible,
    });
  }

  // Protocolo autónomo sin médico responsable configurado → escalar en lugar de fallar en silencio.
  if (!responsible) {
    return escalateToDoctor({
      sessionToken,
      appointment,
      vitalSignId,
      assessment: {
        ...assessment,
        requiresDoctor: true,
        prescriptionAuthorized: false,
        summary:
          "El caso encaja en un protocolo, pero no hay médico responsable preautorizado configurado. Se requiere revisión médica remota.",
        treatmentPlan: "Se escala a teleconsulta. No se emite receta automática.",
        redFlags: [...assessment.redFlags, "Médico responsable no configurado"],
      },
      responsible,
    });
  }

  return issueProtocolCare({
    sessionToken,
    appointment,
    vitalSignId,
    assessment,
    clinical,
    doctorId,
    responsible,
  });
}

async function escalateToDoctor(params: {
  sessionToken: string;
  appointment: typeof appointmentsTable.$inferSelect;
  vitalSignId: number;
  assessment: ClinicalAssessment;
  responsible: Awaited<ReturnType<typeof getActiveResponsiblePhysician>>;
}) {
  const { appointment, assessment, vitalSignId, sessionToken, responsible } = params;

  // Garantizar médico asignado (cola de estación hace innerJoin con users).
  let doctorId = responsible?.doctorId ?? appointment.doctorId;
  if (!doctorId) {
    const doctors = await getActiveDoctors();
    doctorId = doctors[0]?.id;
  }
  if (!doctorId) {
    return {
      ok: false as const,
      error: "No hay médicos activos para asignar la teleconsulta",
    };
  }

  let meetingUrl = appointment.meetingUrl;
  let meetingRoomName = appointment.meetingRoomName;
  let roomError: string | null = null;

  if (!meetingUrl) {
    const created = await createDailyRoom(appointment.id);
    if (created.ok) {
      meetingUrl = created.room.url;
      meetingRoomName = created.room.name;
    } else {
      roomError = created.error;
      console.error("[kiosk/escalate] Daily room failed", created.error);
    }
  }

  const inProgress = await getAppointmentStatusByCode("in_progress");
  await db
    .update(appointmentsTable)
    .set({
      doctorId,
      modality: "teleconsulta",
      meetingUrl: meetingUrl ?? appointment.meetingUrl,
      meetingRoomName: meetingRoomName ?? appointment.meetingRoomName,
      appointmentStatusId: inProgress?.id ?? appointment.appointmentStatusId,
      notes: `${appointment.notes ?? ""}\nEscalado estación IA → teleconsulta: ${assessment.redFlags.join("; ") || "fuera de protocolo"}`.trim(),
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, appointment.id));

  // Avisar al médico asignado/responsable + todos los médicos activos (telemedicina).
  const allDoctors = await getActiveDoctors();
  const notifyIds = [
    doctorId,
    appointment.doctorId,
    responsible?.doctorId,
    ...allDoctors.map((d) => d.id),
  ].filter((id): id is number => typeof id === "number" && id > 0);

  let notified = 0;
  try {
    const notifyResult = await notifyDoctorsStationTeleconsulta({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorUserIds: notifyIds,
      redFlags: assessment.redFlags,
      meetingUrl: meetingUrl ?? null,
    });
    notified = notifyResult.notified;
  } catch (err) {
    console.error("[kiosk/escalate] notify failed", err);
  }

  const assessmentDraft: KioskAssessmentDraft = {
    ...assessment,
    responsibleDoctorName: responsible?.name ?? null,
    responsibleDoctorLicense: responsible?.professionalLicense ?? null,
    consultationId: null,
    prescriptionId: null,
    prescriptionFolio: null,
    roomError,
  };

  await db
    .update(stationKioskSessionsTable)
    .set({
      vitalSignId,
      assessmentDraft,
      currentStep: "waiting",
      status: "waiting_doctor",
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, sessionToken));

  revalidatePath("/estacion");
  revalidatePath(`/estacion/sala/${appointment.id}`);
  revalidatePath(`/consultas/cita/${appointment.id}`);
  revalidatePath("/notificaciones");
  revalidatePath("/agenda");

  return {
    ok: true as const,
    path: "doctor" as const,
    step: "waiting" as const,
    assessment: assessmentDraft,
    meetingUrl: meetingUrl ?? null,
    roomError,
    appointmentId: appointment.id,
    notified,
  };
}

async function issueProtocolCare(params: {
  sessionToken: string;
  appointment: typeof appointmentsTable.$inferSelect;
  vitalSignId: number;
  assessment: ClinicalAssessment;
  clinical: ClinicalDraft;
  doctorId: number;
  responsible: Awaited<ReturnType<typeof getActiveResponsiblePhysician>>;
}) {
  const { appointment, assessment, vitalSignId, clinical, sessionToken, doctorId, responsible } =
    params;

  if (!responsible) {
    return { ok: false as const, error: "No hay médico responsable preautorizado configurado" };
  }

  const [consultation] = await db
    .insert(consultationsTable)
    .values({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId,
      reason: clinical.chiefComplaint,
      currentIllness: clinical.chiefComplaint,
      physicalExam: `Signos vitales en estación. Motor: ${assessment.engine}. Protocolo: ${assessment.protocolCode}`,
      diagnosis: `Evaluación preliminar: ${assessment.diagnosis}`,
      treatmentPlan: normalizeAssessmentText(
        assessment.treatmentPlan,
        "Seguir indicaciones del protocolo autorizado.",
      ),
      instructions: normalizeAssessmentText(
        assessment.instructions,
        "Sigue las indicaciones del protocolo y regresa si aparecen signos de alarma.",
      ),
      clinicalSummary: normalizeAssessmentText(assessment.summary, assessment.diagnosis),
    })
    .returning({ id: consultationsTable.id });

  let prescriptionId: number | null = null;
  let prescriptionFolio: string | null = null;

  if (assessment.prescriptionAuthorized && assessment.medications.length > 0) {
    const [prescription] = await db
      .insert(prescriptionsTable)
      .values({
        consultationId: consultation.id,
        patientId: appointment.patientId,
        doctorId,
        generalNotes: `Receta por protocolo preautorizado ${assessment.protocolCode} (${assessment.protocolName}). Médico responsable: ${responsible.name}. Motor: ${assessment.engine}.`,
      })
      .returning({ id: prescriptionsTable.id });

    prescriptionId = prescription.id;
    const folioData = buildPrescriptionFolio(prescription.id);
    prescriptionFolio = folioData.folio;
    await db
      .update(prescriptionsTable)
      .set({
        prescriptionFolio: folioData.folio,
        verificationCode: folioData.verificationCode,
      })
      .where(eq(prescriptionsTable.id, prescription.id));

    await db.insert(prescriptionItemsTable).values(
      assessment.medications.map((item) => ({
        prescriptionId: prescription.id,
        medication: item.medication,
        dose: item.dose,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route,
        instructions: item.instructions,
      })),
    );
  }

  const completed = await getAppointmentStatusByCode("completed");
  await db
    .update(appointmentsTable)
    .set({
      doctorId,
      appointmentStatusId: completed?.id ?? appointment.appointmentStatusId,
      notes: `${appointment.notes ?? ""}\nAtención por protocolo ${assessment.protocolCode}`.trim(),
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, appointment.id));

  const assessmentDraft: KioskAssessmentDraft = {
    ...assessment,
    summary: normalizeAssessmentText(assessment.summary, assessment.diagnosis),
    treatmentPlan: normalizeAssessmentText(
      assessment.treatmentPlan,
      "Seguir indicaciones del protocolo autorizado.",
    ),
    instructions: normalizeAssessmentText(
      assessment.instructions,
      "Sigue las indicaciones del protocolo y regresa si aparecen signos de alarma.",
    ),
    responsibleDoctorName: responsible.name,
    responsibleDoctorLicense: responsible.professionalLicense,
    consultationId: consultation.id,
    prescriptionId,
    prescriptionFolio,
    roomError: null,
  };

  await db
    .update(stationKioskSessionsTable)
    .set({
      vitalSignId,
      assessmentDraft,
      currentStep: "result",
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, sessionToken));

  return {
    ok: true as const,
    path: "autonomous" as const,
    step: "result" as const,
    assessment: assessmentDraft,
    meetingUrl: null,
    roomError: null,
    appointmentId: appointment.id,
    notified: 0,
  };
}
