import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  consultationsTable,
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  usersTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import {
  formatDiagnosisOptions,
  formatMedicationOptions,
  formatSymptomOptions,
} from "@/lib/catalog/format-options";
import {
  getActiveDiagnoses,
  getActiveMedications,
  getActiveSymptoms,
} from "@/lib/queries/catalogs";
import { ConsultationWorkspace } from "@/components/forms/ConsultationWorkspace";
import { BrandLogo } from "@/components/BrandLogo";
import { PageHeader } from "@/components/ui/PageHeader";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { cardClassName } from "@/lib/ui/classes";
import { getPrescriptionSignature } from "@/lib/queries/signatures";
import { IntakeSummary } from "@/components/intake/IntakeSummary";
import { StationKioskPatientPanel } from "@/components/intake/StationKioskPatientPanel";
import { CrisisPatientCompleteForm } from "@/components/forms/CrisisPatientCompleteForm";
import { FocusRecetaOnLoad } from "@/components/forms/FocusRecetaOnLoad";
import { getKioskSessionByAppointment } from "@/lib/queries/kiosk-session";
import { getVisitIntakeByAppointment } from "@/lib/queries/visit-intake";
import { Suspense } from "react";
import {
  createDoctorDailyToken,
  parseDailyRoomName,
} from "@/lib/video/daily";

export default async function ConsultationByAppointmentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId: apptIdStr } = await params;
  const appointmentId = Number(apptIdStr);
  if (!Number.isFinite(appointmentId)) notFound();

  const session = await requireSession();

  const [appointment] = await db
    .select({
      id: appointmentsTable.id,
      reason: appointmentsTable.reason,
      modality: appointmentsTable.modality,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
      patientId: appointmentsTable.patientId,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      patientChart: patientsTable.chartNumber,
      patientBirthDate: patientsTable.birthDate,
      patientSex: patientsTable.sex,
      patientPhone: patientsTable.phone,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(eq(appointmentsTable.id, appointmentId));

  if (!appointment) notFound();

  // Sala Daily viva (misma que la Dell). Solo crea si falta o expiró.
  let meetingUrl = appointment.meetingUrl;
  if (appointment.modality === "teleconsulta") {
    try {
      const { ensureLiveAppointmentMeetingUrl } = await import("@/lib/video/ensure-meeting");
      meetingUrl = await ensureLiveAppointmentMeetingUrl(appointmentId);
    } catch (err) {
      console.error("[consultas/cita] ensure meeting failed", err);
      meetingUrl = meetingUrl ?? null;
    }
  }

  const doctorDisplayNameEarly = session?.name?.trim() || "Médico";
  let doctorDailyToken: string | null = null;
  if (appointment.modality === "teleconsulta" && meetingUrl) {
    const roomName =
      parseDailyRoomName(meetingUrl) || appointment.meetingRoomName?.trim() || null;
    if (roomName) {
      const tokenResult = await createDoctorDailyToken({
        roomName,
        userName: doctorDisplayNameEarly,
      });
      if (tokenResult.ok) {
        doctorDailyToken = tokenResult.token;
      } else {
        console.error("[consultas/cita] doctor Daily token failed", tokenResult.error);
      }
    }
  }

  const intake = await getVisitIntakeByAppointment(appointmentId);
  const kioskSession = await getKioskSessionByAppointment(appointmentId);
  // Solo fuerza flujo de estación en citas presenciales sin datos.
  // Teleconsulta del médico (SMS /t, app, bridge) NUNCA debe redirigir a /estacion/flujo:
  // ahí se pierden síntomas, vitales y la opción de receta.
  if (
    appointment.modality !== "teleconsulta" &&
    !intake &&
    !kioskSession
  ) {
    redirect(`/estacion/flujo?cita=${appointmentId}`);
  }

  const [consultation] = await db
    .select()
    .from(consultationsTable)
    .where(eq(consultationsTable.appointmentId, appointmentId));

  let prescriptionData = null;
  if (consultation) {
    const [prescription] = await db
      .select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.consultationId, consultation.id));

    if (prescription) {
      const items = await db
        .select()
        .from(prescriptionItemsTable)
        .where(eq(prescriptionItemsTable.prescriptionId, prescription.id));
      prescriptionData = {
        id: prescription.id,
        generalNotes: prescription.generalNotes,
        items: items.map((i) => ({
          medication: i.medication,
          dose: i.dose ?? undefined,
          frequency: i.frequency ?? undefined,
          duration: i.duration ?? undefined,
          route: i.route ?? undefined,
          instructions: i.instructions ?? undefined,
        })),
      };
    }
  }

  const [latestVitals] = await db
    .select()
    .from(vitalSignsTable)
    .where(eq(vitalSignsTable.appointmentId, appointmentId))
    .orderBy(desc(vitalSignsTable.recordedAt))
    .limit(1);

  const [symptoms, diagnoses, medications] = await Promise.all([
    getActiveSymptoms(),
    getActiveDiagnoses(),
    getActiveMedications(),
  ]);

  const patientName = formatPersonName({
    firstName: appointment.patientFirstName,
    lastNamePaternal: appointment.patientLastNamePaternal,
    lastNameMaternal: appointment.patientLastNameMaternal,
  });

  const prescriptionSignature = prescriptionData?.id
    ? await getPrescriptionSignature(prescriptionData.id)
    : null;

  const clinicalDraft = kioskSession?.clinicalDraft ?? {};
  const isCrisisPatient =
    clinicalDraft.crisisMode === true ||
    clinicalDraft.crisisIntent === true ||
    (appointment.patientFirstName === "Paciente" &&
      appointment.patientLastNamePaternal === "Urgencia");

  const doctorDisplayName = session?.name?.trim() || "Médico";
  const isTeleconsulta = appointment.modality === "teleconsulta";
  const liveMeetingUrl = meetingUrl ?? appointment.meetingUrl;

  if (isTeleconsulta) {
    return (
      <div data-teleconsulta-doctor className="min-h-dvh bg-slate-100">
        <Suspense fallback={null}>
          <FocusRecetaOnLoad />
        </Suspense>

        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo width={110} />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Teleconsulta
                </p>
                <p className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  {patientName}
                  <span className="font-medium text-slate-500"> · {appointment.patientChart}</span>
                </p>
              </div>
            </div>
            <Link
              href="/consultas"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Salir
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 py-2 sm:px-4">
            <a
              href="#video"
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Video
            </a>
            <a
              href="#kiosk-datos"
              className="shrink-0 rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900"
            >
              Datos kiosco
            </a>
            <a
              href="#receta"
              className="shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              Receta
            </a>
          </nav>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-4 pb-10">
          {liveMeetingUrl ? (
            <section id="video" className="scroll-mt-24">
              <DailyVideoRoom
                meetingUrl={liveMeetingUrl}
                title={`Paciente ${patientName}`}
                userName={doctorDisplayName}
                token={doctorDailyToken}
                variant="doctor"
                appointmentId={appointmentId}
              />
            </section>
          ) : (
            <section className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-4">
              No se pudo crear la sala de videollamada. Revise Daily.co (`VIDEO_API_KEY`) o abra de
              nuevo el enlace.
            </section>
          )}

          <div className="space-y-4 px-3 sm:px-4">
            {isCrisisPatient && can(session?.role, "patients:write") ? (
              <CrisisPatientCompleteForm
                patientId={appointment.patientId}
                appointmentId={appointmentId}
                defaults={{
                  firstName: appointment.patientFirstName,
                  lastNamePaternal: appointment.patientLastNamePaternal,
                  lastNameMaternal: appointment.patientLastNameMaternal,
                  birthDate: appointment.patientBirthDate,
                  sex: appointment.patientSex,
                  phone: appointment.patientPhone,
                }}
              />
            ) : null}

            <div id="kiosk-datos" className="scroll-mt-28">
              {kioskSession ? (
                <StationKioskPatientPanel
                  clinicalDraft={kioskSession.clinicalDraft}
                  vitalsDraft={kioskSession.vitalsDraft}
                  assessmentDraft={kioskSession.assessmentDraft}
                  paymentStatus={kioskSession.paymentStatus}
                />
              ) : (
                <section className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
                  <p className="font-semibold">Sin datos de kiosco aún</p>
                  <p className="mt-1 text-sm">
                    Complete la nota clínica abajo y emita receta si corresponde.
                  </p>
                </section>
              )}
            </div>

            {intake ? <IntakeSummary intake={intake} /> : null}

            <div id="receta" className="scroll-mt-28">
              <div className="mb-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-emerald-950">
                <p className="font-bold">Crear o firmar receta</p>
                <p className="mt-1 text-sm">
                  Guarde la consulta → medicamentos → Guardar receta → Firmar
                </p>
              </div>
              <ConsultationWorkspace
                appointmentId={appointmentId}
                patientId={appointment.patientId}
                consultation={consultation ?? null}
                prescription={prescriptionData}
                diagnosisOptions={formatDiagnosisOptions(diagnoses)}
                symptomOptions={formatSymptomOptions(symptoms)}
                medicationOptions={formatMedicationOptions(medications)}
                canWriteConsultation={can(session?.role, "consultations:write")}
                canWritePrescription={can(session?.role, "prescriptions:write")}
                canWriteFollowUp={can(session?.role, "followups:write")}
                canUploadDocuments={can(session?.role, "patients:write")}
                canSignPrescription={can(session?.role, "signatures:write")}
                prescriptionId={prescriptionData?.id}
                prescriptionSigned={!!prescriptionSignature}
                prescriptionSignatureHash={prescriptionSignature?.signatureHash}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Suspense fallback={null}>
        <FocusRecetaOnLoad />
      </Suspense>
      <PageHeader
        title="Consulta médica"
        description={`${patientName} · ${appointment.patientChart}`}
        backHref={`/agenda/${appointmentId}`}
        action={
          liveMeetingUrl ? (
            <a
              href="#video"
              className="rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm text-teal-800 hover:bg-teal-50"
            >
              Ir al video
            </a>
          ) : undefined
        }
      />

      {liveMeetingUrl ? (
        <section id="video" className="mb-6 scroll-mt-4">
          <DailyVideoRoom
            meetingUrl={liveMeetingUrl}
            title={`Paciente ${patientName} · ${appointment.patientChart}`}
            userName={doctorDisplayName}
            token={doctorDailyToken}
            variant="doctor"
          />
        </section>
      ) : null}

      {isCrisisPatient && can(session?.role, "patients:write") ? (
        <CrisisPatientCompleteForm
          patientId={appointment.patientId}
          appointmentId={appointmentId}
          defaults={{
            firstName: appointment.patientFirstName,
            lastNamePaternal: appointment.patientLastNamePaternal,
            lastNameMaternal: appointment.patientLastNameMaternal,
            birthDate: appointment.patientBirthDate,
            sex: appointment.patientSex,
            phone: appointment.patientPhone,
          }}
        />
      ) : null}

      {kioskSession ? (
        <div id="kiosk-datos" className="mb-6 scroll-mt-4">
          <StationKioskPatientPanel
            clinicalDraft={kioskSession.clinicalDraft}
            vitalsDraft={kioskSession.vitalsDraft}
            assessmentDraft={kioskSession.assessmentDraft}
            paymentStatus={kioskSession.paymentStatus}
          />
        </div>
      ) : (
        <section className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="font-semibold">Sin datos de kiosco aún</p>
          <p className="mt-1 text-sm">
            Si el paciente entró por urgencia, puede no haber signos vitales. Complete el alta y la
            nota clínica abajo, y emita receta si corresponde.
          </p>
        </section>
      )}

      {intake ? (
        <div className="mb-6">
          <IntakeSummary intake={intake} />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <aside className={`${cardClassName} lg:col-span-1`}>
          <h2 className="mb-3 font-medium text-slate-900">Paciente</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium">{patientName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Expediente</dt>
              <dd>{appointment.patientChart}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Motivo de cita</dt>
              <dd>{appointment.reason ?? "—"}</dd>
            </div>
          </dl>
          <Link
            href={`/pacientes/${appointment.patientId}?tab=expediente`}
            className="mt-4 inline-block text-sm text-teal-700 hover:underline"
          >
            Ver expediente →
          </Link>

          {latestVitals && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-slate-800">Signos vitales (guardados)</h3>
              <p className="text-sm text-slate-600">
                PA {latestVitals.systolicPressure}/{latestVitals.diastolicPressure}
                <br />
                FC {latestVitals.heartRate ?? "—"} · SpO2 {latestVitals.oxygenSaturation ?? "—"}
                <br />
                Temp {latestVitals.temperature ?? "—"} °C · Peso {latestVitals.weight ?? "—"} kg
              </p>
            </div>
          )}
        </aside>

        <div id="receta" className="scroll-mt-4 lg:col-span-2">
          <div className="mb-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-base text-emerald-950">
            <p className="font-bold">Crear o firmar receta</p>
            <p className="mt-1 text-sm sm:text-base">
              1) Guarde la consulta · 2) Complete medicamentos · 3) Guardar receta · 4) Firmar
            </p>
          </div>
          <ConsultationWorkspace
            appointmentId={appointmentId}
            patientId={appointment.patientId}
            consultation={consultation ?? null}
            prescription={prescriptionData}
            diagnosisOptions={formatDiagnosisOptions(diagnoses)}
            symptomOptions={formatSymptomOptions(symptoms)}
            medicationOptions={formatMedicationOptions(medications)}
            canWriteConsultation={can(session?.role, "consultations:write")}
            canWritePrescription={can(session?.role, "prescriptions:write")}
            canWriteFollowUp={can(session?.role, "followups:write")}
            canUploadDocuments={can(session?.role, "patients:write")}
            canSignPrescription={can(session?.role, "signatures:write")}
            prescriptionId={prescriptionData?.id}
            prescriptionSigned={!!prescriptionSignature}
            prescriptionSignatureHash={prescriptionSignature?.signatureHash}
          />
        </div>
      </div>
    </div>
  );
}
