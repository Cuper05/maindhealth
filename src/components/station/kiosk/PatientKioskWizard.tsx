"use client";

import { useCallback, useEffect, useState } from "react";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { STATION_CONSENT_TEXT } from "@/lib/station/copy";
import type { KioskStep } from "@/lib/db/schema/station-kiosk";
import { WelcomeIllustration, WaitingIllustration } from "./KioskIllustrations";
import {
  KioskCard,
  KioskError,
  KioskPrimaryButton,
  KioskSecondaryButton,
  kioskInputClassName,
  kioskLabelClassName,
} from "./KioskTheme";
import { VitalStepScreen } from "./VitalStepScreen";
import { VitalsSummaryGrid } from "./VitalsPanel";
import { KioskShell } from "./KioskShell";
import {
  kioskApi,
  type AppointmentPayload,
  type DoctorOption,
  type PatientPayload,
  type TodayAppointment,
  type VitalsDraft,
} from "./kiosk-api";

type ClinicalForm = {
  chiefComplaint: string;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasAsthma: boolean;
  hasHeartDisease: boolean;
  hasAllergies: boolean;
  allergyDetails: string;
  currentMedications: string;
  consentAccepted: boolean;
  consentSignerName: string;
};

const emptyClinical = (): ClinicalForm => ({
  chiefComplaint: "",
  hasDiabetes: false,
  hasHypertension: false,
  hasAsthma: false,
  hasHeartDisease: false,
  hasAllergies: false,
  allergyDetails: "",
  currentMedications: "",
  consentAccepted: false,
  consentSignerName: "",
});

const VITAL_STEPS: KioskStep[] = [
  "blood_pressure",
  "oxygen",
  "weight_height",
  "temperature",
];

export function PatientKioskWizard() {
  const [step, setStep] = useState<KioskStep>("welcome");
  const [patient, setPatient] = useState<PatientPayload | null>(null);
  const [appointment, setAppointment] = useState<AppointmentPayload | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [patientType, setPatientType] = useState<"new" | "returning" | null>(null);
  const [vitalsDraft, setVitalsDraft] = useState<VitalsDraft>({});
  const [deviceStatus, setDeviceStatus] = useState("idle");
  const [clinical, setClinical] = useState<ClinicalForm>(emptyClinical);
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const showVitalsPanel = VITAL_STEPS.includes(step) || step === "summary";

  const goToStep = useCallback(async (next: KioskStep, extra?: Record<string, unknown>) => {
    setStep(next);
    await kioskApi.patchSession({ currentStep: next, ...extra });
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const data = await kioskApi.getSession();
      if (data.session) {
        const restoredStep = data.session.currentStep as KioskStep;
        if (restoredStep !== "welcome") {
          setStep(restoredStep);
        }
        setPatientType((data.session.patientType as "new" | "returning") ?? null);
        setAppointmentId(data.session.appointmentId ?? null);
        setVitalsDraft(data.session.vitalsDraft ?? {});
        setDeviceStatus(data.session.deviceStatus ?? "idle");
        if (data.patient) setPatient(data.patient);
        if (data.appointment) setAppointment(data.appointment);
      }
    } catch {
      /* sin sesión previa: mostrar bienvenida */
    } finally {
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    loadSession();
    kioskApi.todayAppointments().then((r) => setTodayAppointments(r.appointments.filter((a) => !a.intakeComplete)));
    kioskApi.doctors().then((r) => setDoctors(r.doctors));
  }, [loadSession]);

  useEffect(() => {
    if (!appointmentId || !VITAL_STEPS.includes(step)) return;
    const timer = setInterval(async () => {
      try {
        const { draft } = await kioskApi.pollReadings(appointmentId);
        if (Object.keys(draft).length > 0) {
          setVitalsDraft((prev) => ({ ...prev, ...draft }));
          await kioskApi.patchVitals(draft, "reading");
        }
      } catch {
        /* ignore poll errors */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [appointmentId, step]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await kioskApi.startSession();
      await goToStep("identification");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function selectAppointment(appt: TodayAppointment) {
    setPatient({
      id: appt.patientId,
      chartNumber: appt.chartNumber,
      name: appt.patientName,
    });
    setAppointmentId(appt.id);
    setAppointment({
      id: appt.id,
      startAt: appt.startAt,
      meetingUrl: appt.meetingUrl,
      modality: appt.modality,
      statusCode: "scheduled",
      doctorName: appt.doctorName,
    });
    setClinical((c) => ({ ...c, consentSignerName: appt.patientName }));
    await kioskApi.patchSession({
      patientId: appt.patientId,
      appointmentId: appt.id,
      patientType: "returning",
    });
    setPatientType("returning");
    setDataConfirmed(false);
  }

  async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const { patient: found, todayAppointment } = await kioskApi.lookup({
        chartNumber: String(fd.get("chartNumber") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        curp: String(fd.get("curp") ?? ""),
      });
      setPatient(found);
      setClinical((c) => ({ ...c, consentSignerName: found.name }));
      if (todayAppointment) {
        await selectAppointment(todayAppointment);
      } else {
        setError("Paciente encontrado pero sin cita pendiente hoy. Acude a recepción.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No encontrado");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await kioskApi.register({
        firstName: fd.get("firstName"),
        lastNamePaternal: fd.get("lastNamePaternal"),
        lastNameMaternal: fd.get("lastNameMaternal") || undefined,
        birthDate: fd.get("birthDate") || undefined,
        sex: fd.get("sex") || undefined,
        phone: fd.get("phone") || undefined,
        email: fd.get("email") || undefined,
        emergencyContactName: fd.get("emergencyContactName") || undefined,
        emergencyContactPhone: fd.get("emergencyContactPhone") || undefined,
        doctorId: Number(fd.get("doctorId")),
      });
      setPatient({
        id: result.patientId,
        chartNumber: result.chartNumber,
        name: result.patientName,
      });
      setAppointmentId(result.appointmentId);
      setAppointment({
        id: result.appointmentId,
        startAt: result.startAt,
        modality: result.modality,
        statusCode: "scheduled",
        doctorName: result.doctorName,
      });
      setClinical((c) => ({ ...c, consentSignerName: result.patientName }));
      setPatientType("new");
      setDataConfirmed(false);
      await kioskApi.patchSession({
        patientId: result.patientId,
        appointmentId: result.appointmentId,
        patientType: "new",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setBusy(false);
    }
  }

  async function submitClinical() {
    if (!appointmentId || !patientType) return;
    if (clinical.chiefComplaint.trim().length < 3) {
      setError("Describe el motivo de consulta");
      return;
    }
    if (!clinical.consentAccepted || clinical.consentSignerName.trim().length < 3) {
      setError("Acepta el consentimiento informado");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await kioskApi.submitIntake({
        appointmentId,
        patientType,
        consentSignerName: clinical.consentSignerName,
        consentAccepted: true,
        chiefComplaint: clinical.chiefComplaint,
        hasDiabetes: clinical.hasDiabetes,
        diabetesDetails: clinical.hasDiabetes ? "Reportado en estación" : undefined,
        hasHypertension: clinical.hasHypertension,
        hypertensionDetails: clinical.hasHypertension ? "Reportado en estación" : undefined,
        hasHeartDisease: clinical.hasHeartDisease,
        heartDiseaseDetails: clinical.hasHeartDisease ? "Reportado en estación" : undefined,
        hasAllergies: clinical.hasAllergies,
        allergyDetails: clinical.hasAllergies ? clinical.allergyDetails || "Reportado en estación" : undefined,
        hasSurgeries: false,
        currentMedications: clinical.currentMedications,
        otherChronicConditions: clinical.hasAsthma ? "Asma" : undefined,
        smokingStatus: "never",
        alcoholUse: "none",
      });
      await kioskApi.patchSession({ clinicalDraft: clinical });
      await goToStep("preparation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function simulateReading(patch: VitalsDraft) {
    setDeviceStatus("reading");
    await kioskApi.patchVitals(patch, "reading");
    setVitalsDraft((prev) => ({ ...prev, ...patch }));
    setTimeout(() => setDeviceStatus("done"), 600);
  }

  async function confirmVitals() {
    setBusy(true);
    setError(null);
    try {
      await kioskApi.confirmVitals();
      await goToStep("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  async function resetKiosk() {
    await kioskApi.resetSession();
    setStep("welcome");
    setPatient(null);
    setAppointment(null);
    setAppointmentId(null);
    setPatientType(null);
    setVitalsDraft({});
    setClinical(emptyClinical());
    setDataConfirmed(false);
  }

  return (
    <KioskShell
      step={step}
      patientName={patient?.name}
      deviceStatus={deviceStatus}
      vitalsDraft={vitalsDraft}
      showVitalsPanel={showVitalsPanel}
    >
      {error && <KioskError message={error} />}

      {step === "welcome" && (
        <KioskCard className="text-center">
          <WelcomeIllustration />
          {!sessionReady && (
            <p className="mt-4 text-sm text-slate-400">Cargando estación…</p>
          )}
          <h2 className="mt-6 text-3xl font-bold text-slate-900 md:text-4xl">Bienvenido</h2>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-slate-600">
            Vamos a registrar tus datos y tomar tus signos vitales antes de tu consulta médica.
          </p>
          <div className="mt-10 flex justify-center">
            <KioskPrimaryButton disabled={busy} onClick={handleStart}>
              Iniciar
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "identification" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Identificación del paciente</h2>
          <p className="mt-2 text-slate-600">Selecciona la opción que corresponda.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <BigChoice
              title="Soy paciente nuevo"
              subtitle="Primera visita a MaindHealth"
              icon="✨"
              onClick={async () => {
                setPatientType("new");
                await kioskApi.patchSession({ patientType: "new" });
                await goToStep("registration");
              }}
            />
            <BigChoice
              title="Ya tengo expediente"
              subtitle="Tengo cita programada hoy"
              icon="📋"
              onClick={async () => {
                setPatientType("returning");
                await kioskApi.patchSession({ patientType: "returning" });
                await goToStep("registration");
              }}
            />
          </div>
        </KioskCard>
      )}

      {step === "registration" && patientType === "returning" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Confirma tu identidad</h2>
          <p className="mt-2 text-slate-600">Selecciona tu cita o busca por teléfono, correo o expediente.</p>
          <div className="mt-6 space-y-2">
            {todayAppointments.map((appt) => (
              <button
                key={appt.id}
                type="button"
                onClick={() => selectAppointment(appt)}
                className={`w-full rounded-xl border-2 px-5 py-4 text-left transition ${
                  appointmentId === appt.id
                    ? "border-[#1d6eb8] bg-[#f0f7ff] shadow-sm"
                    : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                }`}
              >
                <span className="text-base font-semibold text-slate-900">{appt.patientName}</span>
                <span className="text-slate-500"> · {appt.chartNumber}</span>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(appt.startAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}Dr(a). {appt.doctorName}
                </p>
              </button>
            ))}
          </div>
          <form onSubmit={handleLookup} className="mt-8 grid gap-4 sm:grid-cols-2">
            <input name="chartNumber" placeholder="Número de expediente" className={kioskInputClassName} />
            <input name="phone" placeholder="Teléfono" className={kioskInputClassName} />
            <input name="email" placeholder="Correo electrónico" className={kioskInputClassName} />
            <input name="curp" placeholder="CURP" className={kioskInputClassName} />
            <div className="sm:col-span-2">
              <KioskPrimaryButton type="submit" disabled={busy}>
                Buscar expediente
              </KioskPrimaryButton>
            </div>
          </form>
          {patient && (
            <ConfirmDataPanel
              patient={patient}
              confirmed={dataConfirmed}
              onConfirm={setDataConfirmed}
              onContinue={async () => goToStep("clinical")}
            />
          )}
        </KioskCard>
      )}

      {step === "registration" && patientType === "new" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Registro de paciente nuevo</h2>
          <p className="mt-2 text-slate-600">Completa tus datos para crear tu expediente.</p>
          <form onSubmit={handleRegister} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" name="firstName" required />
            <Field label="Apellido paterno *" name="lastNamePaternal" required />
            <Field label="Apellido materno" name="lastNameMaternal" />
            <Field label="Fecha de nacimiento" name="birthDate" type="date" />
            <div>
              <label className={kioskLabelClassName}>Sexo</label>
              <select name="sex" className={kioskInputClassName}>
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
            </div>
            <Field label="Teléfono *" name="phone" required />
            <Field label="Correo" name="email" type="email" />
            <Field label="Contacto de emergencia" name="emergencyContactName" />
            <Field label="Tel. emergencia" name="emergencyContactPhone" />
            <div className="sm:col-span-2">
              <label className={kioskLabelClassName}>Médico para la consulta *</label>
              <select name="doctorId" required className={kioskInputClassName}>
                <option value="">Seleccionar médico…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <KioskPrimaryButton type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Continuar"}
              </KioskPrimaryButton>
            </div>
          </form>
          {patient && (
            <ConfirmDataPanel
              patient={patient}
              confirmed={dataConfirmed}
              onConfirm={setDataConfirmed}
              onContinue={async () => goToStep("clinical")}
            />
          )}
        </KioskCard>
      )}

      {step === "clinical" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Formulario clínico inicial</h2>
          <p className="mt-1 text-slate-600">Responde con sinceridad. Toca Sí o No en cada pregunta.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className={kioskLabelClassName}>Motivo de consulta hoy *</label>
              <textarea
                rows={2}
                value={clinical.chiefComplaint}
                onChange={(e) => setClinical({ ...clinical, chiefComplaint: e.target.value })}
                className={kioskInputClassName}
                placeholder="Describe brevemente por qué vienes hoy"
              />
            </div>
            <YesNo label="¿Tienes diabetes?" checked={clinical.hasDiabetes} onChange={(v) => setClinical({ ...clinical, hasDiabetes: v })} />
            <YesNo label="¿Tienes hipertensión?" checked={clinical.hasHypertension} onChange={(v) => setClinical({ ...clinical, hasHypertension: v })} />
            <YesNo label="¿Tienes asma?" checked={clinical.hasAsthma} onChange={(v) => setClinical({ ...clinical, hasAsthma: v })} />
            <YesNo label="¿Enfermedades del corazón?" checked={clinical.hasHeartDisease} onChange={(v) => setClinical({ ...clinical, hasHeartDisease: v })} />
            <YesNo label="¿Alergia a medicamentos?" checked={clinical.hasAllergies} onChange={(v) => setClinical({ ...clinical, hasAllergies: v })} />
            {clinical.hasAllergies && (
              <input
                value={clinical.allergyDetails}
                onChange={(e) => setClinical({ ...clinical, allergyDetails: e.target.value })}
                placeholder="¿Cuáles medicamentos?"
                className={kioskInputClassName}
              />
            )}
            <div>
              <label className={kioskLabelClassName}>¿Tomas medicamentos actualmente?</label>
              <textarea
                rows={2}
                value={clinical.currentMedications}
                onChange={(e) => setClinical({ ...clinical, currentMedications: e.target.value })}
                className={kioskInputClassName}
                placeholder="Nombre y dosis, si aplica"
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
              {STATION_CONSENT_TEXT}
            </div>
            <input
              value={clinical.consentSignerName}
              onChange={(e) => setClinical({ ...clinical, consentSignerName: e.target.value })}
              placeholder="Nombre completo para consentimiento"
              className={kioskInputClassName}
            />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-[#1d6eb8]"
                checked={clinical.consentAccepted}
                onChange={(e) => setClinical({ ...clinical, consentAccepted: e.target.checked })}
              />
              <span className="text-sm font-medium text-slate-700">Acepto el consentimiento informado</span>
            </label>
          </div>
          <div className="mt-8">
            <KioskPrimaryButton disabled={busy} onClick={submitClinical}>
              Continuar
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "preparation" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Preparación para signos vitales</h2>
          <p className="mt-3 text-lg text-slate-600">
            A continuación tomaremos tus signos vitales. Sigue las instrucciones en pantalla paso a paso.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              { icon: "🫀", label: "Presión arterial" },
              { icon: "🫁", label: "Oxigenación y pulso" },
              { icon: "⚖️", label: "Peso y altura" },
              { icon: "🌡️", label: "Temperatura" },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-5 py-4"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                  {item.icon}
                </span>
                <span className="text-base font-medium text-slate-800">{item.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <KioskPrimaryButton onClick={() => goToStep("blood_pressure")}>Comenzar</KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "blood_pressure" && (
        <VitalStepScreen
          stepNumber={1}
          totalSteps={4}
          title="Presión arterial"
          instruction="Coloca tu brazo en el equipo de presión arterial y permanece quieto hasta que termine la lectura."
          illustration="blood_pressure"
          deviceStatus={
            deviceStatus === "reading" ? "reading" : vitalsDraft.systolicPressure ? "done" : "waiting"
          }
          onSimulate={() => simulateReading({ systolicPressure: "118", diastolicPressure: "76", heartRate: "72" })}
          onContinue={async () => {
            if (!vitalsDraft.systolicPressure) {
              setError("Espera la lectura o usa simular en modo demo");
              return;
            }
            setError(null);
            await goToStep("oxygen");
          }}
          onBack={() => goToStep("preparation")}
        />
      )}

      {step === "oxygen" && (
        <VitalStepScreen
          stepNumber={2}
          totalSteps={4}
          title="Oxigenación y pulso"
          instruction="Coloca tu dedo en el sensor del oxímetro y espera unos segundos sin moverte."
          illustration="oxygen"
          deviceStatus={
            deviceStatus === "reading" ? "reading" : vitalsDraft.oxygenSaturation ? "done" : "waiting"
          }
          onSimulate={() => simulateReading({ oxygenSaturation: "98", heartRate: vitalsDraft.heartRate ?? "72" })}
          onContinue={async () => {
            if (!vitalsDraft.oxygenSaturation) {
              setError("Espera la lectura de SpO₂");
              return;
            }
            setError(null);
            await goToStep("weight_height");
          }}
          onBack={() => goToStep("blood_pressure")}
        />
      )}

      {step === "weight_height" && (
        <VitalStepScreen
          stepNumber={3}
          totalSteps={4}
          title="Peso y altura"
          instruction="Sube a la estación de medición y permanece erguido hasta completar la lectura."
          illustration="weight_height"
          deviceStatus={
            deviceStatus === "reading" ? "reading" : vitalsDraft.weight ? "done" : "waiting"
          }
          onSimulate={() => simulateReading({ weight: "81.4", height: "1.76", bmi: "26.3" })}
          onContinue={async () => {
            if (!vitalsDraft.weight || !vitalsDraft.height) {
              setError("Espera lectura de peso y altura");
              return;
            }
            setError(null);
            await goToStep("temperature");
          }}
          onBack={() => goToStep("oxygen")}
        />
      )}

      {step === "temperature" && (
        <VitalStepScreen
          stepNumber={4}
          totalSteps={4}
          title="Temperatura"
          instruction="Permanece frente al sensor de temperatura según las instrucciones del equipo."
          illustration="temperature"
          deviceStatus={
            deviceStatus === "reading" ? "reading" : vitalsDraft.temperature ? "done" : "waiting"
          }
          onSimulate={() => simulateReading({ temperature: "36.7" })}
          onContinue={async () => {
            if (!vitalsDraft.temperature) {
              setError("Espera la lectura de temperatura");
              return;
            }
            setError(null);
            await goToStep("summary");
          }}
          onBack={() => goToStep("weight_height")}
        />
      )}

      {step === "summary" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Resumen de signos vitales</h2>
          <p className="mt-2 text-slate-600">Revisa que todo esté correcto antes de confirmar.</p>
          <VitalsSummaryGrid draft={vitalsDraft} />
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <KioskPrimaryButton disabled={busy} onClick={confirmVitals}>
              Confirmar
            </KioskPrimaryButton>
            <KioskSecondaryButton onClick={() => goToStep("blood_pressure")}>
              Repetir medición
            </KioskSecondaryButton>
          </div>
        </KioskCard>
      )}

      {step === "waiting" && appointment && (
        <KioskCard className="text-center">
          <WaitingIllustration />
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Espera de consulta</h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-slate-600">
            Tus signos vitales han sido registrados correctamente.
          </p>
          <p className="mt-3 text-slate-600">
            En breve iniciarás tu consulta con{" "}
            <strong className="text-[#1a4d7c]">Dr(a). {appointment.doctorName}</strong>
          </p>
          <p className="mt-4 inline-flex rounded-full bg-[#f0f7ff] px-4 py-2 text-sm font-medium text-[#1d6eb8]">
            Cita:{" "}
            {new Date(appointment.startAt).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <div className="mt-10 flex justify-center">
            <KioskPrimaryButton onClick={() => goToStep("consultation")}>
              Ir a teleconsulta
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "consultation" && appointment?.meetingUrl && (
        <KioskCard>
          <h2 className="text-xl font-bold text-slate-900">Inicio de teleconsulta</h2>
          <p className="mt-1 text-sm text-slate-500">Tu médico te atenderá por videollamada.</p>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <DailyVideoRoom meetingUrl={appointment.meetingUrl} title="Consulta médica" />
          </div>
          <button
            type="button"
            onClick={resetKiosk}
            className="mt-6 text-sm text-slate-500 hover:text-[#1d6eb8]"
          >
            Finalizar y atender siguiente paciente
          </button>
        </KioskCard>
      )}

      {step === "consultation" && !appointment?.meetingUrl && (
        <KioskCard className="text-center">
          <WaitingIllustration />
          <p className="mt-4 text-lg text-slate-600">El médico aún no ha abierto la sala de videollamada.</p>
          <p className="mt-2 text-sm text-slate-500">Permanece en espera; te avisaremos cuando esté lista.</p>
          <div className="mt-6">
            <KioskSecondaryButton onClick={() => goToStep("waiting")}>Volver a espera</KioskSecondaryButton>
          </div>
        </KioskCard>
      )}
    </KioskShell>
  );
}

function BigChoice({
  title,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border-2 border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-8 text-left shadow-sm transition hover:border-[#1d6eb8]/40 hover:shadow-md active:scale-[0.99]"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f7ff] text-3xl transition group-hover:bg-[#1d6eb8]/10">
        {icon}
      </span>
      <p className="mt-5 text-xl font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </button>
  );
}

function ConfirmDataPanel({
  patient,
  confirmed,
  onConfirm,
  onContinue,
}: {
  patient: PatientPayload;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-[#1d6eb8]/20 bg-[#f0f7ff]/50 p-5">
      <p className="text-lg font-semibold text-slate-900">{patient.name}</p>
      <p className="text-sm text-slate-500">Expediente {patient.chartNumber}</p>
      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <input
          type="checkbox"
          className="h-5 w-5 rounded text-[#1d6eb8]"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
        />
        <span className="text-sm font-medium text-slate-700">Confirmo que mis datos son correctos</span>
      </label>
      <div className="mt-4">
        <KioskPrimaryButton disabled={!confirmed} onClick={onContinue}>
          Continuar
        </KioskPrimaryButton>
      </div>
    </div>
  );
}

function YesNo({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-w-[72px] rounded-lg px-4 py-2 text-sm font-semibold transition ${
            !checked ? "bg-[#1d6eb8] text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-w-[72px] rounded-lg px-4 py-2 text-sm font-semibold transition ${
            checked ? "bg-[#1d6eb8] text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          Sí
        </button>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className={kioskLabelClassName}>{label}</label>
      <input name={name} type={type} required={required} className={kioskInputClassName} />
    </div>
  );
}
