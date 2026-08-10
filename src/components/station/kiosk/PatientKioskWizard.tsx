"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STATION_CONSENT_TEXT } from "@/lib/station/copy";
import type { KioskStep } from "@/lib/db/schema/station-kiosk";
import { readStationOximeter } from "@/lib/kiosk/station-oximeter";
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
import { kioskTextFieldProps } from "./KioskOnScreenKeyboard";
import { SymptomGuide } from "./SymptomGuide";
import { DownloadPrescriptionButton } from "./DownloadPrescriptionButton";
import {
  buildChiefComplaintFromSelection,
  emptySymptomSelection,
  getSymptomSelectionGaps,
  isSymptomSelectionComplete,
  symptomSelectionFromUnknown,
  type SymptomSelection,
} from "@/lib/kiosk/symptom-catalog";
import {
  displayTreatmentPlan,
  normalizeAssessmentText,
} from "@/lib/kiosk/assessment-text";
import {
  kioskApi,
  type AppointmentPayload,
  type AssessmentPayload,
  type PatientPayload,
  type PaymentOrder,
  type StationService,
  type VitalsDraft,
} from "./kiosk-api";

type ClinicalForm = {
  chiefComplaint: string;
  symptomSelection: SymptomSelection;
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
  symptomSelection: emptySymptomSelection(),
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

const PREVIOUS_STEP: Partial<Record<KioskStep, KioskStep>> = {
  service: "welcome",
  payment: "service",
  identification: "payment",
  registration: "identification",
  clinical: "registration",
  preparation: "clinical",
  blood_pressure: "preparation",
  oxygen: "blood_pressure",
  weight_height: "oxygen",
  temperature: "weight_height",
  summary: "temperature",
  analysis: "summary",
  waiting: "summary",
};

function formatMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

const VITAL_FIELDS: Record<string, (keyof VitalsDraft)[]> = {
  blood_pressure: ["systolicPressure", "diastolicPressure"],
  oxygen: ["oxygenSaturation"],
  weight_height: ["weight", "height", "bmi"],
  temperature: ["temperature"],
};

/** Si ya hay lectura del paso, no bloquear en "reading" (evita Continuar/Atrás trabados). */
function resolveVitalUiStatus(
  deviceStatus: string,
  hasReading: boolean,
): "idle" | "waiting" | "reading" | "done" | "retry" {
  if (hasReading) return "done";
  if (deviceStatus === "reading") return "reading";
  if (deviceStatus === "retry") return "retry";
  if (deviceStatus === "idle") return "idle";
  return "waiting";
}

function vitalsCompleteForStep(step: string, draft: VitalsDraft) {
  const fields = VITAL_FIELDS[step];
  if (!fields?.length) return false;
  return fields.every((field) => Boolean(draft[field]));
}

function clinicalFromDraft(draft: Record<string, unknown> | null | undefined): ClinicalForm {
  const base = emptyClinical();
  if (!draft) return base;
  const symptomSelection = symptomSelectionFromUnknown(draft.symptomSelection);
  const chiefFromSelection = buildChiefComplaintFromSelection(symptomSelection);
  return {
    chiefComplaint:
      chiefFromSelection ||
      (typeof draft.chiefComplaint === "string" ? draft.chiefComplaint : base.chiefComplaint),
    symptomSelection,
    hasDiabetes: Boolean(draft.hasDiabetes),
    hasHypertension: Boolean(draft.hasHypertension),
    hasAsthma: Boolean(draft.hasAsthma),
    hasHeartDisease: Boolean(draft.hasHeartDisease),
    hasAllergies: Boolean(draft.hasAllergies),
    allergyDetails: typeof draft.allergyDetails === "string" ? draft.allergyDetails : base.allergyDetails,
    currentMedications:
      typeof draft.currentMedications === "string" ? draft.currentMedications : base.currentMedications,
    consentAccepted: Boolean(draft.consentAccepted),
    consentSignerName:
      typeof draft.consentSignerName === "string" ? draft.consentSignerName : base.consentSignerName,
  };
}

export function PatientKioskWizard() {
  const [step, setStep] = useState<KioskStep>("welcome");
  const [patient, setPatient] = useState<PatientPayload | null>(null);
  const [appointment, setAppointment] = useState<AppointmentPayload | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [patientType, setPatientType] = useState<"new" | "returning" | null>(null);
  const [vitalsDraft, setVitalsDraft] = useState<VitalsDraft>({});
  const [deviceStatus, setDeviceStatus] = useState("idle");
  const [clinical, setClinical] = useState<ClinicalForm>(emptyClinical);
  const [assessment, setAssessment] = useState<AssessmentPayload | null>(null);
  const [services, setServices] = useState<StationService[]>([]);
  const [selectedService, setSelectedService] = useState<StationService | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("unpaid");
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Errores del paso clínico mostrados junto a Continuar (sticky). */
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [highlightSymptomGaps, setHighlightSymptomGaps] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oxygenStatus, setOxygenStatus] = useState<string>("");
  const [oxygenCapturing, setOxygenCapturing] = useState(false);
  const oxygenCaptureLock = useRef(false);

  const showVitalsPanel = VITAL_STEPS.includes(step) || step === "summary" || step === "analysis";

  const goToStep = useCallback(async (next: KioskStep, extra?: Record<string, unknown>) => {
    setError(null);
    setClinicalError(null);
    setHighlightSymptomGaps(false);
    setStep(next);
    await kioskApi.patchSession({ currentStep: next, ...extra });
  }, []);

  const goBack = useCallback(async () => {
    const previous = PREVIOUS_STEP[step];
    if (!previous) return;
    setDeviceStatus("idle");
    await goToStep(previous);
  }, [goToStep, step]);

  const clearVitalFields = useCallback(async (fields: (keyof VitalsDraft)[]) => {
    const patch: Record<string, string> = {};
    for (const field of fields) patch[field] = "";
    setVitalsDraft((prev) => {
      const next = { ...prev };
      for (const field of fields) delete next[field];
      return next;
    });
    setDeviceStatus("waiting");
    setError(null);
    await kioskApi.patchVitals(patch, "waiting");
  }, []);

  const applyVisit = useCallback(
    (result: {
      patientId: number;
      appointmentId: number;
      chartNumber: string;
      patientName: string;
      startAt: string;
      doctorName: string;
      modality: string;
    }, type: "new" | "returning") => {
      setPatient({
        id: result.patientId,
        chartNumber: result.chartNumber,
        name: result.patientName,
      });
      setAppointmentId(result.appointmentId);
      setAppointment({
        id: result.appointmentId,
        startAt: result.startAt,
        meetingUrl: null,
        modality: result.modality,
        statusCode: "scheduled",
        doctorName: result.doctorName,
      });
      setPatientType(type);
      setClinical((c) => ({ ...c, consentSignerName: result.patientName }));
      setDataConfirmed(true);
    },
    [],
  );

  const loadSession = useCallback(async () => {
    try {
      // ?nueva=1 fuerza borrar la cookie/sesión (útil en pruebas de estación)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("nueva") === "1" || params.get("reset") === "1") {
          await kioskApi.resetSession();
          params.delete("nueva");
          params.delete("reset");
          const qs = params.toString();
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${qs ? `?${qs}` : ""}`,
          );
          return;
        }
      }

      const data = await kioskApi.getSession();
      if (data.session) {
        let restoredStep = data.session.currentStep as KioskStep;
        // "analysis" es transitorio: si recargan a mitad, no dejar la UI en "Procesando…"
        if (restoredStep === "analysis") {
          restoredStep = "summary";
          await kioskApi.patchSession({ currentStep: "summary" });
        }
        // La videoconsulta NO corre en el kiosk táctil (sin cámara/mic).
        // Si quedó en "consultation" por una sesión vieja, volver a espera con instrucciones.
        if (restoredStep === "consultation") {
          restoredStep = "waiting";
          await kioskApi.patchSession({ currentStep: "waiting" });
        }
        if (restoredStep !== "welcome") setStep(restoredStep);
        setPatientType((data.session.patientType as "new" | "returning") ?? null);
        setAppointmentId(data.session.appointmentId ?? null);
        setVitalsDraft(data.session.vitalsDraft ?? {});
        // "reading" persistido ocultaba el botón de oxímetro para siempre.
        const restoredStatus = data.session.deviceStatus ?? "idle";
        setDeviceStatus(restoredStatus === "reading" ? "waiting" : restoredStatus);
        setClinical(clinicalFromDraft(data.session.clinicalDraft));
        if (data.session.assessmentDraft) setAssessment(data.session.assessmentDraft);
        setPaymentStatus(data.session.paymentStatus ?? "unpaid");
        if (data.paymentOrder) {
          setPaymentOrder(data.paymentOrder);
          setPaymentStatus(data.paymentOrder.status);
        } else if (restoredStep === "payment") {
          // Sesión en pago sin orden recuperable: vuelve a elegir servicio
          setStep("service");
          await kioskApi.patchSession({ currentStep: "service" });
        }
        if (data.patient) {
          setPatient(data.patient);
          setDataConfirmed(true);
        }
        if (data.appointment) setAppointment(data.appointment);
      }
    } catch {
      /* sin sesión previa */
    } finally {
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    loadSession();
    kioskApi.listServices().then((r) => setServices(r.services)).catch(() => setServices([]));
  }, [loadSession]);

  // Si el paso actual ya tiene lecturas, desbloquear (evita atascos en "reading").
  useEffect(() => {
    if (!VITAL_STEPS.includes(step)) return;
    if (vitalsCompleteForStep(step, vitalsDraft)) {
      setDeviceStatus("done");
    }
  }, [step, vitalsDraft]);

  useEffect(() => {
    if (!appointmentId || !VITAL_STEPS.includes(step)) return;
    // Oxígeno se lee con el servicio local (botón); el poll ocultaba el botón al poner "reading".
    if (step === "oxygen") return;
    const timer = setInterval(async () => {
      try {
        const { draft } = await kioskApi.pollReadings(appointmentId);
        if (Object.keys(draft).length === 0) return;
        setVitalsDraft((prev) => {
          const next = { ...prev, ...draft };
          const complete = vitalsCompleteForStep(step, next);
          if (complete) setDeviceStatus("done");
          void kioskApi.patchVitals(draft, complete ? "done" : "waiting");
          return next;
        });
      } catch {
        /* ignore poll errors */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [appointmentId, step]);

  useEffect(() => {
    if (step !== "waiting") return;
    const timer = setInterval(async () => {
      try {
        const data = await kioskApi.getSession();
        if (data.appointment?.meetingUrl) {
          setAppointment(data.appointment);
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [step]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      // Asegura no arrastrar paciente/vitals de una sesión anterior en memoria.
      setPatient(null);
      setAppointment(null);
      setAppointmentId(null);
      setPatientType(null);
      setVitalsDraft({});
      setClinical(emptyClinical());
      setAssessment(null);
      setSelectedService(null);
      setPaymentOrder(null);
      setPaymentStatus("unpaid");
      setDataConfirmed(false);
      setDeviceStatus("idle");
      setOxygenStatus("");
      setOxygenCapturing(false);
      await kioskApi.startSession();
      await goToStep("service");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function selectService(service: StationService) {
    setBusy(true);
    setError(null);
    try {
      setSelectedService(service);
      const { order } = await kioskApi.createPayment(service.id);
      setPaymentOrder(order);
      setPaymentStatus(order.status);
      await goToStep("payment");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el cobro");
    } finally {
      setBusy(false);
    }
  }

  async function approvePaymentDemo() {
    if (!paymentOrder) return;
    setBusy(true);
    setError(null);
    try {
      const result = await kioskApi.confirmPayment(paymentOrder.id, "approved");
      setPaymentOrder(result.order);
      setPaymentStatus(result.order.status);
      await goToStep("identification");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pago no confirmado");
    } finally {
      setBusy(false);
    }
  }

  async function rejectPaymentDemo() {
    if (!paymentOrder) return;
    setBusy(true);
    setError(null);
    try {
      const result = await kioskApi.confirmPayment(paymentOrder.id, "rejected");
      setPaymentOrder(result.order);
      setPaymentStatus(result.order.status);
      setError("Pago rechazado. Puedes reintentar o elegir otro servicio.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setBusy(false);
    }
  }

  async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const { patient: found } = await kioskApi.lookup({
        chartNumber: String(fd.get("chartNumber") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        curp: String(fd.get("curp") ?? ""),
      });
      const visit = await kioskApi.startWalkIn(found.id);
      applyVisit(visit, "returning");
      await kioskApi.patchSession({
        patientId: visit.patientId,
        appointmentId: visit.appointmentId,
        patientType: "returning",
      });
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
      });
      applyVisit(result, "new");
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
    if (!appointmentId || !patientType) {
      const msg =
        "Falta la sesión de la cita. Vuelve a Identificación/Datos o reinicia la estación.";
      setClinicalError(msg);
      setError(msg);
      return;
    }

    const symptomGaps = getSymptomSelectionGaps(clinical.symptomSelection);
    if (symptomGaps.length > 0 || !isSymptomSelectionComplete(clinical.symptomSelection)) {
      const msg =
        symptomGaps.length > 0
          ? symptomGaps.join(" · ")
          : "Completa cada síntoma: intensidad y desde cuándo.";
      setClinicalError(msg);
      setHighlightSymptomGaps(true);
      setError(msg);
      document.getElementById("symptom-detail-section")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    const chiefComplaint = buildChiefComplaintFromSelection(clinical.symptomSelection);
    if (chiefComplaint.trim().length < 3) {
      const msg = "Completa la selección de síntomas";
      setClinicalError(msg);
      setHighlightSymptomGaps(true);
      setError(msg);
      return;
    }
    if (!clinical.consentAccepted || clinical.consentSignerName.trim().length < 3) {
      const msg = !clinical.consentAccepted
        ? "Marca la casilla de consentimiento informado"
        : "Escribe tu nombre completo para el consentimiento (mínimo 3 caracteres)";
      setClinicalError(msg);
      setError(msg);
      return;
    }

    setBusy(true);
    setError(null);
    setClinicalError(null);
    setHighlightSymptomGaps(false);
    const clinicalPayload = { ...clinical, chiefComplaint };
    try {
      await kioskApi.submitIntake({
        appointmentId,
        patientType,
        consentSignerName: clinical.consentSignerName,
        consentAccepted: true,
        chiefComplaint,
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
      setClinical(clinicalPayload);
      await kioskApi.patchSession({ clinicalDraft: clinicalPayload });
      await goToStep("preparation");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar el historial clínico";
      setClinicalError(msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function simulateReading(patch: VitalsDraft) {
    setDeviceStatus("reading");
    setVitalsDraft((prev) => ({ ...prev, ...patch }));
    await kioskApi.patchVitals(patch, "reading");
    window.setTimeout(() => {
      setDeviceStatus("done");
      void kioskApi.patchVitals({}, "done");
    }, 600);
  }

  const captureOximeter = useCallback(async () => {
    if (oxygenCaptureLock.current) return;
    oxygenCaptureLock.current = true;
    setError(null);
    setOxygenCapturing(true);
    setDeviceStatus("reading");
    setOxygenStatus("Iniciando lectura del oxímetro…");
    try {
      const sample = await readStationOximeter((msg) => setOxygenStatus(msg));
      const patch: VitalsDraft = {
        oxygenSaturation: String(sample.spo2),
        heartRate: String(sample.hr),
      };
      setVitalsDraft((prev) => ({ ...prev, ...patch }));
      await kioskApi.patchVitals(patch, "done");
      setDeviceStatus("done");
      setOxygenStatus(`SpO₂ ${sample.spo2}% · FC ${sample.hr} lpm`);
    } catch (err) {
      setDeviceStatus("retry");
      const msg = err instanceof Error ? err.message : "No se pudo leer el oxímetro";
      setOxygenStatus(msg);
      setError(msg);
    } finally {
      setOxygenCapturing(false);
      oxygenCaptureLock.current = false;
    }
  }, []);

  // Al entrar a oxígeno sin SpO2, siempre idle (nunca quedarse en "reading" de sesión vieja).
  useEffect(() => {
    if (step !== "oxygen") return;
    if (vitalsDraft.oxygenSaturation) {
      setDeviceStatus("done");
      return;
    }
    setOxygenCapturing(false);
    setDeviceStatus("idle");
    setOxygenStatus("Pulsa el botón verde «Leer oxímetro ahora».");
  }, [step, vitalsDraft.oxygenSaturation]);

  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      // Paso local primero para feedback inmediato; el patch no debe borrar errores luego.
      setStep("analysis");
      await kioskApi.patchSession({ currentStep: "analysis" });
      const result = await Promise.race([
        kioskApi.assess(),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("El análisis tardó demasiado. Intenta de nuevo.")),
            45_000,
          );
        }),
      ]);
      setAssessment(result.assessment);
      if (result.meetingUrl) {
        setAppointment((prev) =>
          prev
            ? { ...prev, meetingUrl: result.meetingUrl, modality: "teleconsulta" }
            : prev,
        );
      } else if (result.path === "doctor") {
        setAppointment((prev) =>
          prev ? { ...prev, modality: "teleconsulta" } : prev,
        );
      }
      // Escalación ya persistió step=waiting en servidor: no volver a summary si falla el patch.
      setStep(result.step);
      try {
        await kioskApi.patchSession({ currentStep: result.step });
      } catch {
        /* estado de UI ya refleja el resultado del assess */
      }
      if (result.path === "doctor" && result.roomError) {
        setError(
          `Teleconsulta creada, pero la sala de video falló: ${result.roomError}. El staff debe revisar VIDEO_API_KEY en el servidor.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en el análisis";
      // Si el servidor ya dejó la sesión en waiting_doctor, no borrar esa escalación.
      try {
        const data = await kioskApi.getSession();
        if (data.session?.status === "waiting_doctor" || data.session?.currentStep === "waiting") {
          if (data.session.assessmentDraft) setAssessment(data.session.assessmentDraft);
          if (data.appointment) setAppointment(data.appointment);
          setStep("waiting");
          setError(msg);
          return;
        }
      } catch {
        /* continuar con fallback a resumen */
      }
      setStep("summary");
      try {
        await kioskApi.patchSession({ currentStep: "summary" });
      } catch {
        /* la UI ya volvió a resumen */
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function resetKiosk() {
    setBusy(true);
    setError(null);
    try {
      await kioskApi.resetSession();
      setStep("welcome");
      setPatient(null);
      setAppointment(null);
      setAppointmentId(null);
      setPatientType(null);
      setVitalsDraft({});
      setClinical(emptyClinical());
      setAssessment(null);
      setSelectedService(null);
      setPaymentOrder(null);
      setPaymentStatus("unpaid");
      setDataConfirmed(false);
      setClinicalError(null);
      setHighlightSymptomGaps(false);
      setDeviceStatus("idle");
      setOxygenStatus("");
      setOxygenCapturing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reiniciar la sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KioskShell
      step={step}
      patientName={patient?.name}
      deviceStatus={deviceStatus}
      vitalsDraft={vitalsDraft}
      showVitalsPanel={showVitalsPanel}
      onNewSession={() => {
        void resetKiosk();
      }}
    >
      {error && step !== "summary" && <KioskError message={error} />}

      {step === "welcome" && (
        <KioskCard className="text-center">
          <WelcomeIllustration />
          {!sessionReady && <p className="mt-4 text-sm text-slate-400">Cargando estación…</p>}
          <h2 className="mt-6 text-3xl font-bold text-slate-900 md:text-4xl">Estación virtual 24/7</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-slate-600">
            Elige el servicio, realiza el pago y continúa con tu atención. La IA hace evaluación preliminar;
            la receta solo se emite si el caso entra en un protocolo preautorizado por el médico responsable.
          </p>
          <p className="mt-3 text-sm text-slate-500">Pago primero · Sin cita previa · Disponible todo el año</p>
          {patient ? (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Hay una sesión anterior de <strong>{patient.name}</strong>. Usa{" "}
              <button type="button" className="font-semibold underline" onClick={() => void resetKiosk()}>
                Nueva atención
              </button>{" "}
              para empezar de cero, o continúa con Iniciar atención (se crea sesión nueva).
            </div>
          ) : null}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <KioskPrimaryButton disabled={busy || !sessionReady} onClick={handleStart}>
              Iniciar atención
            </KioskPrimaryButton>
            {patient ? (
              <KioskSecondaryButton disabled={busy} onClick={() => void resetKiosk()}>
                Nueva atención
              </KioskSecondaryButton>
            ) : null}
          </div>
        </KioskCard>
      )}

      {step === "service" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Selecciona el servicio</h2>
          <p className="mt-2 text-slate-600">
            Revisa el precio y las condiciones. El cobro se realiza antes de iniciar la atención clínica.
          </p>
          <div className="mt-8 space-y-3">
            {services.length === 0 && (
              <p className="text-sm text-slate-500">No hay servicios configurados. Contacta a soporte.</p>
            )}
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                disabled={busy}
                onClick={() => selectService(service)}
                className="flex w-full items-start justify-between gap-4 rounded-2xl border-2 border-slate-100 bg-gradient-to-b from-white to-slate-50/80 px-5 py-5 text-left transition hover:border-[#1d6eb8]/40"
              >
                <div>
                  <p className="text-lg font-bold text-slate-900">{service.name}</p>
                  {service.description && (
                    <p className="mt-1 text-sm text-slate-500">{service.description}</p>
                  )}
                </div>
                <p className="shrink-0 text-lg font-semibold text-[#1d6eb8]">
                  {formatMoney(service.amountCents, service.currency)}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
            <KioskSecondaryButton
              onClick={async () => {
                setBusy(true);
                try {
                  await resetKiosk();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Volver al inicio
            </KioskSecondaryButton>
          </div>
        </KioskCard>
      )}

      {step === "payment" && paymentOrder && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Pago en terminal</h2>
          <p className="mt-2 text-slate-600">
            Acerca tu tarjeta al terminal Nayax VPOS Touch. Solo con pago aprobado se abre la sesión clínica.
          </p>
          <div className="mt-6 rounded-2xl border border-[#1d6eb8]/20 bg-[#f0f7ff]/60 p-5">
            <p className="text-sm text-slate-500">Concepto</p>
            <p className="text-lg font-semibold text-slate-900">{paymentOrder.concept}</p>
            <p className="mt-4 text-sm text-slate-500">Importe</p>
            <p className="text-3xl font-bold text-[#1d6eb8]">
              {formatMoney(paymentOrder.amountCents, paymentOrder.currency)}
            </p>
            <p className="mt-4 text-sm text-slate-500">Referencia</p>
            <p className="font-mono text-sm text-slate-800">{paymentOrder.reference}</p>
            <p className="mt-3 text-xs text-slate-500">
              Estado: <span className="font-semibold">{paymentStatus}</span>
            </p>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            No se guardan datos de tarjeta. El comprobante financiero queda separado del expediente clínico.
            Integración Nayax lista a nivel de orden; hoy puedes simular la respuesta del terminal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack} disabled={busy}>
              ← Cambiar servicio
            </KioskSecondaryButton>
            <KioskSecondaryButton
              onClick={async () => {
                setBusy(true);
                try {
                  await resetKiosk();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Volver al inicio
            </KioskSecondaryButton>
            <KioskSecondaryButton onClick={rejectPaymentDemo} disabled={busy}>
              Simular rechazo
            </KioskSecondaryButton>
            <KioskPrimaryButton onClick={approvePaymentDemo} disabled={busy}>
              {busy ? "Confirmando…" : "Simular pago aprobado (Nayax)"}
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "payment" && !paymentOrder && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Pago no disponible</h2>
          <p className="mt-2 text-slate-600">
            No se encontró la orden de pago de esta sesión. Puedes elegir el servicio de nuevo o reiniciar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack} disabled={busy}>
              ← Cambiar servicio
            </KioskSecondaryButton>
            <KioskPrimaryButton
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await resetKiosk();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Volver al inicio
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "identification" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Identificación</h2>
          <p className="mt-2 text-slate-600">
            Pago confirmado. Continúa con tu identificación. No necesitas cita previa.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <BigChoice
              title="Soy paciente nuevo"
              subtitle="Alta de expediente en este momento"
              icon="✨"
              onClick={async () => {
                setPatientType("new");
                await kioskApi.patchSession({ patientType: "new" });
                await goToStep("registration");
              }}
            />
            <BigChoice
              title="Ya tengo expediente"
              subtitle="Buscar y reutilizar mis datos"
              icon="📋"
              onClick={async () => {
                setPatientType("returning");
                await kioskApi.patchSession({ patientType: "returning" });
                await goToStep("registration");
              }}
            />
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
          </div>
        </KioskCard>
      )}

      {step === "registration" && patientType === "returning" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Buscar expediente</h2>
          <p className="mt-2 text-slate-600">
            Ingresa teléfono, correo, CURP o número de expediente. No se requiere cita previa.
          </p>
          <form onSubmit={handleLookup} className="mt-8 grid gap-4 sm:grid-cols-2">
            <input
              name="chartNumber"
              placeholder="Número de expediente"
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <input
              name="phone"
              placeholder="Teléfono"
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <input
              name="email"
              placeholder="Correo electrónico"
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <input
              name="curp"
              placeholder="CURP"
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <div className="sm:col-span-2">
              <KioskPrimaryButton type="submit" disabled={busy}>
                {busy ? "Buscando…" : "Buscar y continuar"}
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
          <div className="mt-8 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
          </div>
        </KioskCard>
      )}

      {step === "registration" && patientType === "new" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Alta de paciente</h2>
          <p className="mt-2 text-slate-600">Completa tus datos para crear tu expediente ahora mismo.</p>
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
              <KioskPrimaryButton type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Crear expediente y continuar"}
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
          <div className="mt-8 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
          </div>
        </KioskCard>
      )}

      {step === "clinical" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Síntomas y antecedentes</h2>
          <p className="mt-1 text-slate-600">
            Selecciona lo que sientes. No necesitas escribir: el sistema arma el motivo de consulta.
          </p>
          <div className="mt-6 space-y-6">
            <SymptomGuide
              value={clinical.symptomSelection}
              highlightIncomplete={highlightSymptomGaps}
              onChange={(symptomSelection) => {
                setClinical({
                  ...clinical,
                  symptomSelection,
                  chiefComplaint: buildChiefComplaintFromSelection(symptomSelection),
                });
                if (highlightSymptomGaps || clinicalError) {
                  const gaps = getSymptomSelectionGaps(symptomSelection);
                  if (gaps.length === 0) {
                    setHighlightSymptomGaps(false);
                    setClinicalError(null);
                    setError(null);
                  } else if (highlightSymptomGaps) {
                    setClinicalError(gaps.join(" · "));
                  }
                }
              }}
            />

            <div className="border-t border-slate-100 pt-6">
              <p className="mb-3 text-sm font-semibold text-slate-800">Antecedentes</p>
              <div className="space-y-3">
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
                    {...kioskTextFieldProps}
                    className={kioskInputClassName}
                  />
                )}
                <div>
                  <label className={kioskLabelClassName}>¿Tomas medicamentos actualmente?</label>
                  <textarea
                    rows={2}
                    value={clinical.currentMedications}
                    onChange={(e) => setClinical({ ...clinical, currentMedications: e.target.value })}
                    {...kioskTextFieldProps}
                    className={kioskInputClassName}
                    placeholder="Nombre y dosis, si aplica"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
              {STATION_CONSENT_TEXT}
            </div>
            <input
              value={clinical.consentSignerName}
              onChange={(e) => {
                setClinical({ ...clinical, consentSignerName: e.target.value });
                if (clinicalError) {
                  setClinicalError(null);
                  setError(null);
                }
              }}
              placeholder="Nombre completo para consentimiento"
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-[#1d6eb8]"
                checked={clinical.consentAccepted}
                onChange={(e) => {
                  setClinical({ ...clinical, consentAccepted: e.target.checked });
                  if (clinicalError) {
                    setClinicalError(null);
                    setError(null);
                  }
                }}
              />
              <span className="text-sm font-medium text-slate-700">Acepto el consentimiento informado</span>
            </label>
          </div>
          <div className="sticky bottom-[var(--kiosk-keyboard-height,0px)] z-10 -mx-6 mt-8 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur md:-mx-8 md:px-8">
            {clinicalError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-semibold">No se puede continuar aún</p>
                <p className="mt-1 leading-relaxed">{clinicalError}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <KioskSecondaryButton onClick={goBack} disabled={busy}>
                ← Atrás
              </KioskSecondaryButton>
              <KioskPrimaryButton disabled={busy} onClick={() => void submitClinical()}>
                {busy ? "Guardando…" : "Continuar"}
              </KioskPrimaryButton>
            </div>
          </div>
        </KioskCard>
      )}

      {step === "preparation" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Preparación para signos vitales</h2>
          <p className="mt-3 text-lg text-slate-600">
            Tomaremos tus signos vitales. La IA los interpretará junto con tus síntomas para definir el
            tratamiento.
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
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
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
          deviceStatus={resolveVitalUiStatus(
            deviceStatus,
            Boolean(vitalsDraft.systolicPressure && vitalsDraft.diastolicPressure),
          )}
          onSimulate={() => simulateReading({ systolicPressure: "118", diastolicPressure: "76", heartRate: "72" })}
          onContinue={async () => {
            if (!vitalsDraft.systolicPressure) {
              setError("Espera la lectura o usa simular en modo demo");
              return;
            }
            setError(null);
            setDeviceStatus("idle");
            await goToStep("oxygen");
          }}
          onBack={goBack}
          onRetry={() => clearVitalFields(VITAL_FIELDS.blood_pressure)}
        />
      )}

      {step === "oxygen" && (
        <VitalStepScreen
          stepNumber={2}
          totalSteps={4}
          title="Oxigenación y pulso"
          instruction="Oxímetro encendido + dedo (números en pantalla). Luego pulsa el botón grande Leer oxímetro. Si Chrome pide red local, elige Permitir."
          illustration="oxygen"
          deviceStatus={resolveVitalUiStatus(deviceStatus, Boolean(vitalsDraft.oxygenSaturation))}
          statusMessage={
            oxygenStatus ||
            (vitalsDraft.oxygenSaturation
              ? `SpO₂ ${vitalsDraft.oxygenSaturation}% · FC ${vitalsDraft.heartRate ?? "—"} lpm`
              : "Listo para leer — pulsa el botón de abajo")
          }
          onCapture={() => void captureOximeter()}
          captureLabel="Leer oxímetro ahora"
          capturing={oxygenCapturing}
          onSimulate={() =>
            simulateReading({
              oxygenSaturation: "98",
              heartRate: vitalsDraft.heartRate ?? "72",
            })
          }
          onContinue={async () => {
            if (!vitalsDraft.oxygenSaturation) {
              setError("Pulsa «Leer oxímetro ahora» primero.");
              return;
            }
            setError(null);
            setOxygenStatus("");
            setDeviceStatus("idle");
            await goToStep("weight_height");
          }}
          onBack={goBack}
          onRetry={async () => {
            await clearVitalFields(["oxygenSaturation", "heartRate"]);
            setOxygenStatus("Pulsa Leer oxímetro ahora");
            setDeviceStatus("idle");
          }}
        />
      )}

      {step === "weight_height" && (
        <VitalStepScreen
          stepNumber={3}
          totalSteps={4}
          title="Peso y altura"
          instruction="Sube a la estación de medición y permanece erguido hasta completar la lectura."
          illustration="weight_height"
          deviceStatus={resolveVitalUiStatus(
            deviceStatus,
            Boolean(vitalsDraft.weight && vitalsDraft.height),
          )}
          onSimulate={() => simulateReading({ weight: "81.4", height: "1.76", bmi: "26.3" })}
          onContinue={async () => {
            if (!vitalsDraft.weight || !vitalsDraft.height) {
              setError("Espera lectura de peso y altura");
              return;
            }
            setError(null);
            setDeviceStatus("waiting");
            await goToStep("temperature");
          }}
          onBack={goBack}
          onRetry={() => clearVitalFields(VITAL_FIELDS.weight_height)}
        />
      )}

      {step === "temperature" && (
        <VitalStepScreen
          stepNumber={4}
          totalSteps={4}
          title="Temperatura"
          instruction="Permanece frente al sensor de temperatura según las instrucciones del equipo."
          illustration="temperature"
          deviceStatus={resolveVitalUiStatus(deviceStatus, Boolean(vitalsDraft.temperature))}
          onSimulate={() => simulateReading({ temperature: "36.7" })}
          onContinue={async () => {
            if (!vitalsDraft.temperature) {
              setError("Espera la lectura de temperatura");
              return;
            }
            setError(null);
            setDeviceStatus("idle");
            await goToStep("summary");
          }}
          onBack={goBack}
          onRetry={() => clearVitalFields(VITAL_FIELDS.temperature)}
        />
      )}

      {step === "summary" && (
        <KioskCard>
          <h2 className="text-2xl font-bold text-slate-900">Resumen de signos vitales</h2>
          <p className="mt-2 text-slate-600">
            Revisa que todo esté correcto. Al continuar, la IA analizará síntomas y signos vitales.
          </p>
          <VitalsSummaryGrid draft={vitalsDraft} />
          {error && (
            <div className="mt-6">
              <KioskError message={error} />
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <KioskSecondaryButton onClick={goBack} disabled={busy}>
              ← Atrás
            </KioskSecondaryButton>
            <KioskSecondaryButton
              disabled={busy}
              onClick={async () => {
                await clearVitalFields([
                  ...VITAL_FIELDS.blood_pressure,
                  ...VITAL_FIELDS.oxygen,
                  ...VITAL_FIELDS.weight_height,
                  ...VITAL_FIELDS.temperature,
                  "heartRate",
                ]);
                await goToStep("blood_pressure");
              }}
            >
              Repetir mediciones
            </KioskSecondaryButton>
            <KioskPrimaryButton disabled={busy} onClick={() => void runAnalysis()}>
              {busy ? "Analizando…" : "Analizar con IA"}
            </KioskPrimaryButton>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="text-sm font-medium text-[#1d6eb8] underline-offset-2 hover:underline"
              onClick={() => goToStep("registration")}
            >
              Corregir datos personales
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              className="text-sm font-medium text-[#1d6eb8] underline-offset-2 hover:underline"
              onClick={() => goToStep("clinical")}
            >
              Corregir síntomas
            </button>
          </div>
        </KioskCard>
      )}

      {step === "analysis" && (
        <KioskCard className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f7ff] text-3xl">
            🧠
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Analizando tu caso</h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-slate-600">
            La inteligencia artificial está interpretando tus síntomas y signos vitales para determinar el
            diagnóstico orientativo y el tratamiento.
          </p>
          <p className="mt-6 animate-pulse text-sm font-medium text-[#1d6eb8]">Procesando…</p>
        </KioskCard>
      )}

      {step === "result" && assessment && (
        <KioskCard>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            {assessment.prescriptionAuthorized
              ? "Atención por protocolo preautorizado"
              : "Evaluación preliminar completada"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{assessment.diagnosis}</h2>
          <p className="mt-3 text-slate-600">{assessment.summary}</p>
          {assessment.protocolName && (
            <p className="mt-3 text-sm text-slate-500">
              Protocolo: <strong>{assessment.protocolCode}</strong> — {assessment.protocolName}
            </p>
          )}
          {assessment.responsibleDoctorName && (
            <p className="mt-1 text-sm text-slate-500">
              Médico responsable: {assessment.responsibleDoctorName}
              {assessment.responsibleDoctorLicense
                ? ` · Cédula ${assessment.responsibleDoctorLicense}`
                : ""}
            </p>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Plan de tratamiento</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {displayTreatmentPlan(assessment.treatmentPlan, assessment.medications)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Indicaciones</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {normalizeAssessmentText(
                  assessment.instructions,
                  "Sigue las indicaciones del protocolo y regresa si aparecen signos de alarma.",
                )}
              </p>
            </div>
          </div>

          {assessment.medications.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800">Medicamentos del protocolo</h3>
              <ul className="mt-3 space-y-2">
                {assessment.medications.map((med) => (
                  <li
                    key={`${med.medication}-${med.dose}`}
                    className="rounded-xl border border-[#1d6eb8]/15 bg-[#f0f7ff]/60 px-4 py-3"
                  >
                    <p className="font-semibold text-slate-900">{med.medication}</p>
                    <p className="text-sm text-slate-600">
                      {[med.dose, med.frequency, med.duration, med.route].filter(Boolean).join(" · ")}
                    </p>
                    {med.instructions && (
                      <p className="mt-1 text-xs text-slate-500">{med.instructions}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.prescriptionId && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Receta emitida bajo protocolo</p>
                {assessment.prescriptionFolio && (
                  <p className="text-xs text-emerald-800">Folio {assessment.prescriptionFolio}</p>
                )}
              </div>
              <DownloadPrescriptionButton
                prescriptionId={assessment.prescriptionId}
                folio={assessment.prescriptionFolio}
              />
            </div>
          )}

          <div className="mt-8 flex justify-center border-t border-slate-100 pt-6">
            <KioskPrimaryButton onClick={resetKiosk}>Finalizar</KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {(step === "waiting" || step === "consultation") && (
        <KioskCard className="text-center">
          <WaitingIllustration />
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Médico notificado</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            La videoconsulta está en la <strong>pantalla principal</strong> (Dell), donde están la
            cámara y los audífonos. Esta pantalla táctil no usa video.
          </p>
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm text-emerald-950">
            <p className="font-semibold">Automático — no hay nada que pulsar aquí</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Teleconsulta creada y médicos avisados.</li>
              <li>
                En la PC Dell (Estación) la sala de video se abre sola.
              </li>
              <li>El médico remoto se une desde su notificación o consulta.</li>
            </ul>
          </div>
          {assessment?.redFlags && assessment.redFlags.length > 0 && (
            <ul className="mx-auto mt-6 max-w-md space-y-2 text-left">
              {assessment.redFlags.map((flag) => (
                <li
                  key={flag}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  {flag}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 animate-pulse text-sm font-medium text-[#1d6eb8]">
            Médico notificado · La videoconsulta está en la pantalla principal…
          </p>
          {assessment?.roomError ? (
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-900">
              <p className="font-semibold">Error al crear la sala Daily</p>
              <p className="mt-1">{assessment.roomError}</p>
              <p className="mt-1 text-xs">
                La teleconsulta sí quedó en cola; el staff debe corregir VIDEO_API_KEY y reabrir la
                sala en Estación.
              </p>
            </div>
          ) : appointment?.meetingUrl ? (
            <p className="mt-3 text-xs text-emerald-700">
              Sala de video lista en la estación Dell. No uses cámara en esta pantalla táctil.
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-700">
              Preparando la sala de video en la pantalla principal…
            </p>
          )}
          {error && step === "waiting" && (
            <div className="mx-auto mt-4 max-w-md">
              <KioskError message={error} />
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-6">
            <KioskPrimaryButton onClick={resetKiosk}>Finalizar y salir</KioskPrimaryButton>
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

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  const usesVirtualKeyboard = !["date", "datetime-local", "month", "week", "time"].includes(type);
  return (
    <div>
      <label className={kioskLabelClassName}>{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        {...(usesVirtualKeyboard ? kioskTextFieldProps : {})}
        className={kioskInputClassName}
      />
    </div>
  );
}
