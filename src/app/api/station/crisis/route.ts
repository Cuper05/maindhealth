import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointmentsTable, stationKioskSessionsTable } from "@/lib/db/schema";
import { createDailyRoom } from "@/lib/video/daily";
import { getActiveResponsiblePhysician } from "@/lib/kiosk/commerce";
import { saveKioskVisitIntake } from "@/lib/kiosk/intake";
import { notifyDoctorsStationTeleconsulta } from "@/lib/kiosk/notify-escalation";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { ensureCrisisPlaceholderForSession } from "@/lib/kiosk/walk-in";
import { getActiveDoctors, getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import type { KioskAssessmentDraft } from "@/lib/db/schema/station-kiosk";

export const maxDuration = 60;
export async function POST() {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 400 });
    }

    const [session] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.token, cookie.token));
    if (!session) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    if (session.paymentStatus !== "approved") {
      return NextResponse.json(
        {
          error:
            "Debe pagar la consulta antes de la teleconsulta de urgencia. Elija el servicio y complete el pago.",
        },
        { status: 400 },
      );
    }

    let patientId = session.patientId;
    let appointmentId = session.appointmentId;

    if (!patientId || !appointmentId) {
      // Sin identificación: un expediente pendiente por sesión (no “Paciente Urgencia” sueltos).
      const registered = await ensureCrisisPlaceholderForSession(session.id);
      if (!registered.ok) {
        return NextResponse.json({ error: registered.error }, { status: 400 });
      }
      patientId = registered.patientId;
      appointmentId = registered.appointmentId;
    }

    const prevClinical =
      typeof session.clinicalDraft === "object" && session.clinicalDraft
        ? (session.clinicalDraft as Record<string, unknown>)
        : {};
    const clinicalDraft: Record<string, unknown> = {
      ...prevClinical,
      crisisMode: true,
      crisisIntent: true,
      chiefComplaint:
        typeof prevClinical.chiefComplaint === "string" && prevClinical.chiefComplaint.trim()
          ? prevClinical.chiefComplaint
          : "Ayuda urgente — modo crisis en estación (pagado)",
      consentAccepted: true,
      consentSignerName:
        typeof prevClinical.consentSignerName === "string" && prevClinical.consentSignerName.trim()
          ? prevClinical.consentSignerName
          : "Modo crisis estación",
    };

    await db
      .update(stationKioskSessionsTable)
      .set({
        patientId,
        appointmentId,
        patientType: session.patientType ?? "new",
        clinicalDraft,
        updatedAt: new Date(),
      })
      .where(eq(stationKioskSessionsTable.token, cookie.token));

    const intakeResult = await saveKioskVisitIntake({
      appointmentId,
      patientType: session.patientType === "returning" ? "returning" : "new",
      consentSignerName: String(clinicalDraft.consentSignerName),
      consentAccepted: true,
      chiefComplaint: String(clinicalDraft.chiefComplaint),
      hasDiabetes: Boolean(clinicalDraft.hasDiabetes),
      diabetesDetails: clinicalDraft.hasDiabetes ? "Reportado en estación" : undefined,
      hasHypertension: Boolean(clinicalDraft.hasHypertension),
      hypertensionDetails: clinicalDraft.hasHypertension ? "Reportado en estación" : undefined,
      hasHeartDisease: Boolean(clinicalDraft.hasHeartDisease),
      heartDiseaseDetails: clinicalDraft.hasHeartDisease ? "Reportado en estación" : undefined,
      hasAllergies: Boolean(clinicalDraft.hasAllergies),
      allergyDetails:
        typeof clinicalDraft.allergyDetails === "string"
          ? clinicalDraft.allergyDetails
          : clinicalDraft.hasAllergies
            ? "Reportado en estación"
            : undefined,
      hasSurgeries: false,
      currentMedications:
        typeof clinicalDraft.currentMedications === "string"
          ? clinicalDraft.currentMedications
          : undefined,
      otherChronicConditions: clinicalDraft.hasAsthma ? "Asma" : undefined,
      smokingStatus: "never",
      alcoholUse: "none",
      additionalNotes: "Modo crisis estación — teleconsulta tras pago aprobado.",
    });
    if (!intakeResult.ok) {
      console.warn("[station/crisis] intake", intakeResult.error);
    }

    const [appointment] = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, appointmentId));
    if (!appointment) {
      return NextResponse.json({ error: "No se pudo crear la visita" }, { status: 500 });
    }

    const responsible = await getActiveResponsiblePhysician();
    let doctorId = responsible?.doctorId ?? appointment.doctorId;
    if (!doctorId) {
      const doctors = await getActiveDoctors();
      doctorId = doctors[0]?.id;
    }
    if (!doctorId) {
      return NextResponse.json({ error: "No hay médicos activos" }, { status: 400 });
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
        reason: "Crisis en estación — teleconsulta tras pago",
        notes: `${appointment.notes ?? ""}\nModo crisis estación (pago aprobado): teleconsulta inmediata.`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(appointmentsTable.id, appointment.id));

    const assessmentDraft: KioskAssessmentDraft = {
      diagnosis: "Atención urgente en estación",
      severity: "high",
      requiresDoctor: true,
      summary:
        "El paciente solicitó ayuda urgente, pagó la consulta y se dispara teleconsulta inmediata.",
      treatmentPlan: "Teleconsulta inmediata. Captura clínica a cargo del médico.",
      instructions: "El médico guiará al paciente en la captura de información si está alterado.",
      redFlags: ["Modo crisis estación", "Pago aprobado"],
      medications: [],
      engine: "rules",
      prescriptionAuthorized: false,
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
        assessmentDraft,
        currentStep: "waiting",
        status: "waiting_doctor",
        updatedAt: new Date(),
      })
      .where(eq(stationKioskSessionsTable.token, cookie.token));

    const allDoctors = await getActiveDoctors();
    const notifyIds = [
      doctorId,
      responsible?.doctorId,
      ...allDoctors.map((d) => d.id),
    ].filter((id): id is number => typeof id === "number" && id > 0);

    try {
      await notifyDoctorsStationTeleconsulta({
        appointmentId: appointment.id,
        patientId,
        doctorUserIds: notifyIds,
        redFlags: ["Modo crisis estación"],
        meetingUrl: meetingUrl ?? null,
        assignedDoctorId: doctorId,
        responsibleDoctorId: responsible?.doctorId ?? null,
      });
    } catch (err) {
      console.error("[station/crisis] notify", err);
    }

    revalidatePath("/estacion");
    revalidatePath("/estacion/panel");
    revalidatePath(`/consultas/cita/${appointment.id}`);

    return NextResponse.json({
      ok: true,
      step: "waiting" as const,
      patientId,
      appointmentId,
      assessment: assessmentDraft,
      meetingUrl: meetingUrl ?? null,
      roomError,
    });
  } catch (error) {
    console.error("[station/crisis]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar ayuda urgente" },
      { status: 500 },
    );
  }
}
