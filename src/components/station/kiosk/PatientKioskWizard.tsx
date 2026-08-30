"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { StationAutoPrintWatcher } from "@/components/station/StationAutoPrintWatcher";
import { STATION_CONSENT_TEXT } from "@/lib/station/copy";
import type { KioskStep } from "@/lib/db/schema/station-kiosk";
import { readStationOximeter } from "@/lib/kiosk/station-oximeter";
import { readStationEcg, confirmStationEcgDone } from "@/lib/kiosk/station-ecg";
import { readStationScale } from "@/lib/kiosk/station-scale";
import { confirmStationBpDone, readStationBp } from "@/lib/kiosk/station-bp";
import { WaitingIllustration, DigitalScaleHeightIcon } from "./KioskIllustrations";
import {
  KioskCard,
  KioskError,
  KioskImportant,
  KioskInfo,
  KioskPrimaryButton,
  KioskSecondaryButton,
  KioskScrollArea,
  kioskBodyClassName,
  kioskHelperClassName,
  kioskInputClassName,
  kioskLabelClassName,
  kioskSubtitleClassName,
  kioskTitleClassName,
} from "./KioskTheme";
import { VitalStepScreen } from "./VitalStepScreen";
import { VitalsSummaryGrid } from "./VitalsPanel";
import { KioskShell } from "./KioskShell";
import { kioskTextFieldProps } from "./KioskOnScreenKeyboard";
import { SymptomGuide } from "./SymptomGuide";
import { DownloadPrescriptionButton } from "./DownloadPrescriptionButton";
import { BirthDateFields } from "./BirthDateFields";
import { useKioskVoice } from "./useKioskVoice";
import {
  CRISIS_CALM_SCRIPTS,
  CRISIS_PAY_FIRST_VOICE,
  STRIPE_QR_WAITING_VOICE,
  TELECONSULTA_ENDED_VOICE,
  ANTECEDENTS_PAGE2_VOICE,
  SCALE_MOUNT_VOICE,
  OXYGEN_START_VOICE,
  BP_START_VOICE,
  ECG_START_VOICE,
  VITAL_DONE_VOICE,
  WEIGHT_HEIGHT_VOICE_STEPS,
  BLOOD_PRESSURE_VOICE_STEPS,
  OXYGEN_VOICE_STEPS,
  OXYGEN_NAIL_TIP,
  TEMPERATURE_VOICE_STEPS,
  ECG_VOICE_STEPS,
  speakKiosk,
  speakKioskError,
  stopKioskVoice,
} from "@/lib/kiosk/voice-guide";
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
  interpretBmi,
  interpretBloodPressure,
  interpretEcg,
  interpretHeartRate,
  interpretHeight,
  interpretSpo2,
  interpretTemperature,
  interpretWeight,
  VITAL_RANGE_COPY,
} from "@/lib/kiosk/vital-ranges";
import {
  kioskApi,
  type AppointmentPayload,
  type AssessmentPayload,
  type KioskAntecedents,
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

type RegistrationDraft = {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  sex: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  kioskUsername: string;
  kioskPassword: string;
};

const emptyRegistrationDraft = (): RegistrationDraft => ({
  firstName: "",
  lastNamePaternal: "",
  lastNameMaternal: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  sex: "",
  phone: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  kioskUsername: "",
  kioskPassword: "",
});

type LoginDraft = { username: string; password: string };
type LookupDraft = { chartNumber: string; phone: string; email: string; curp: string };
type ProfileDraft = { username: string; password: string };

const emptyLoginDraft = (): LoginDraft => ({ username: "", password: "" });
const emptyLookupDraft = (): LookupDraft => ({
  chartNumber: "",
  phone: "",
  email: "",
  curp: "",
});
const emptyProfileDraft = (): ProfileDraft => ({ username: "", password: "" });

const VITAL_STEPS: KioskStep[] = [
  "weight_height",
  "blood_pressure",
  "oxygen",
  "temperature",
  "ecg",
];

const PREVIOUS_STEP: Partial<Record<KioskStep, KioskStep>> = {
  service: "welcome",
  payment: "service",
  identification: "payment",
  registration: "identification",
  symptoms: "registration",
  antecedents: "symptoms",
  consent: "antecedents",
  /** Sesiones viejas guardadas en el paso único "clinical". */
  clinical: "registration",
  preparation: "consent",
  weight_height: "preparation",
  blood_pressure: "weight_height",
  oxygen: "blood_pressure",
  temperature: "oxygen",
  ecg: "temperature",
  summary: "ecg",
  analysis: "summary",
  waiting: "summary",
};

function formatMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

const VITAL_FIELDS: Record<string, (keyof VitalsDraft)[]> = {
  weight_height: ["weight", "height", "bmi"],
  blood_pressure: ["systolicPressure", "diastolicPressure"],
  oxygen: ["oxygenSaturation"],
  temperature: ["temperature"],
  ecg: ["ecgStatus"],
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

/** Precarga los antecedentes guardados del perfil para no volver a preguntarlos. */
function clinicalWithAntecedents(
  base: ClinicalForm,
  antecedents: KioskAntecedents | null | undefined,
): ClinicalForm {
  if (!antecedents) return base;
  return {
    ...base,
    hasDiabetes: Boolean(antecedents.hasDiabetes),
    hasHypertension: Boolean(antecedents.hasHypertension),
    hasAsthma: Boolean(antecedents.hasAsthma),
    hasHeartDisease: Boolean(antecedents.hasHeartDisease),
    hasAllergies: Boolean(antecedents.hasAllergies),
    allergyDetails: antecedents.allergyDetails ?? base.allergyDetails,
    currentMedications: antecedents.currentMedications ?? base.currentMedications,
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
  /** Correo del paciente: recibo Stripe + se reutiliza en el alta. */
  const [receiptEmail, setReceiptEmail] = useState("");
  /** Pago QR: el paciente paga en el celular; el kiosco espera confirmación. */
  const [stripePay, setStripePay] = useState<{
    url: string;
    sessionId: string;
    qrDataUrl: string;
  } | null>(null);
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Errores del paso clínico mostrados junto a Continuar (sticky). */
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [highlightSymptomGaps, setHighlightSymptomGaps] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  /**
   * La voz se activa al tocar “Iniciar atención” / crisis (gesto del usuario).
   * Ya no hay pantalla bloqueante de audífonos: al recargar se va al inicio.
   * Audio: bocina + micrófono fijos de la estación (higiene e inclusión).
   */
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  /** Ayuda urgente: teleconsulta inmediata + voz de calma en bucle. */
  const [crisisMode, setCrisisMode] = useState(false);
  /** Crisis: primero pagar, luego disparar teleconsulta. */
  const [crisisIntent, setCrisisIntent] = useState(false);
  /** Teleconsulta terminó: mostrar cierre y volver a welcome. */
  const [callEnded, setCallEnded] = useState(false);
  /** Médico ya en llamada: corta la voz de calma. */
  const [doctorJoined, setDoctorJoined] = useState(false);
  /** Subpantallas compactas (evitan scroll). */
  const [idMode, setIdMode] = useState<"choose" | "login" | "new" | "returning">("choose");
  const [regPage, setRegPage] = useState<1 | 2 | 3>(1);
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft>(emptyRegistrationDraft);
  const [loginDraft, setLoginDraft] = useState<LoginDraft>(emptyLoginDraft);
  const [lookupDraft, setLookupDraft] = useState<LookupDraft>(emptyLookupDraft);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [antePage, setAntePage] = useState<1 | 2>(1);
  /**
   * Corrección desde el resumen de signos: al terminar (o con Atrás)
   * vuelve aquí en lugar de seguir el flujo normal del kiosk.
   */
  const [editReturnStep, setEditReturnStep] = useState<KioskStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [oxygenStatus, setOxygenStatus] = useState<string>("");
  const [oxygenCapturing, setOxygenCapturing] = useState(false);
  const oxygenCaptureLock = useRef(false);
  const [scaleStatus, setScaleStatus] = useState<string>("");
  const [scaleCapturing, setScaleCapturing] = useState(false);
  const scaleCaptureLock = useRef(false);
  const [bpStatus, setBpStatus] = useState<string>("");
  const [bpCapturing, setBpCapturing] = useState(false);
  const bpCaptureLock = useRef(false);
  const [ecgStatusMsg, setEcgStatusMsg] = useState<string>("");
  const [ecgCapturing, setEcgCapturing] = useState(false);
  const ecgCaptureLock = useRef(false);
  const calmSilencedRef = useRef(false);
  const doctorJoinedRef = useRef(false);
  const endingCallRef = useRef(false);
  /** Evita procesar dos veces el retorno de Stripe Checkout. */
  const stripeReturnHandledRef = useRef(false);
  /** Evita que el toque de «Continuar» (paso 2) dispare el submit del paso 3 (mismo sitio táctil). */
  const blockRegisterSubmitUntilRef = useRef(0);
  const regPageRef = useRef(regPage);
  regPageRef.current = regPage;
  const crisisIntentRef = useRef(crisisIntent);
  crisisIntentRef.current = crisisIntent;

  const patchRegistration = useCallback(<K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => {
    setRegistrationDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goRegPage = useCallback((next: 1 | 2 | 3) => {
    if (next === 3) {
      // ~800 ms: el dedo suelta encima del botón que acaba de cambiar a submit.
      blockRegisterSubmitUntilRef.current = Date.now() + 800;
    }
    setRegPage(next);
  }, []);

  const showVitalsPanel = step === "summary" || step === "analysis";
  const { muted: voiceMuted, toggleMuted: toggleVoice } = useKioskVoice(
    step,
    sessionReady && voiceEnabled && !crisisMode,
  );

  // Si ya hay paciente identificado, el consentimiento debe traer su nombre precargado.
  useEffect(() => {
    if (step !== "consent") return;
    const patientName = patient?.name?.trim();
    if (!patientName) return;
    setClinical((c) =>
      c.consentSignerName.trim() ? c : { ...c, consentSignerName: patientName },
    );
  }, [step, patient?.name]);

  useEffect(() => {
    doctorJoinedRef.current = doctorJoined;
  }, [doctorJoined]);

  const goToStep = useCallback(async (next: KioskStep, extra?: Record<string, unknown>) => {
    setError(null);
    setClinicalError(null);
    setHighlightSymptomGaps(false);
    setStep(next);
    await kioskApi.patchSession({ currentStep: next, ...extra });
  }, []);

  /** Error de validación: visible y hablado, para quien no puede leer bien la pantalla. */
  const failWithVoice = useCallback((message: string) => {
    setError(message);
    speakKioskError(message);
  }, []);

  const failClinical = useCallback((message: string, highlightGaps = false) => {
    setClinicalError(message);
    setError(message);
    if (highlightGaps) setHighlightSymptomGaps(true);
    speakKioskError(message);
  }, []);

  const finishEditAndReturn = useCallback(
    async (extra?: Record<string, unknown>) => {
      const target = editReturnStep;
      if (!target) return false;
      setEditReturnStep(null);
      setDeviceStatus("idle");
      await goToStep(target, extra);
      return true;
    },
    [editReturnStep, goToStep],
  );

  const beginCorrectionFromSummary = useCallback(
    async (target: KioskStep) => {
      setEditReturnStep("summary");
      setError(null);
      setClinicalError(null);
      await goToStep(target);
    },
    [goToStep],
  );

  const goBack = useCallback(async () => {
    setDeviceStatus("idle");

    // Corrección desde resumen: Atrás = volver al resumen, no al flujo previo.
    if (editReturnStep) {
      const target = editReturnStep;
      setEditReturnStep(null);
      const extra =
        step === "symptoms"
          ? {
              clinicalDraft: {
                ...clinical,
                chiefComplaint: buildChiefComplaintFromSelection(clinical.symptomSelection),
              },
            }
          : undefined;
      await goToStep(target, extra);
      return;
    }

    // Tras identificar paciente, no reabrir alta/búsqueda vacía desde síntomas.
    if (step === "symptoms" && patient) {
      if (patientType === "returning") {
        await goToStep("registration");
        return;
      }
      setIdMode("choose");
      await goToStep("identification");
      return;
    }

    const previous = PREVIOUS_STEP[step];
    if (!previous) return;
    // Si salimos del alta/búsqueda, volver a la elección de identificación (no a una subpantalla vacía).
    if (step === "registration" && previous === "identification") {
      setIdMode("choose");
      setRegPage(1);
    }
    await goToStep(previous);
  }, [goToStep, step, patient, patientType, editReturnStep, clinical]);

  /** Desde “Buscar expediente” / alta: regresa a la pantalla de elección (nuevo / expediente / login). */
  const backToIdentificationChoice = useCallback(async () => {
    setIdMode("choose");
    setRegPage(1);
    setPatientType(null);
    setPatient(null);
    setDataConfirmed(false);
    setAppointmentId(null);
    setAppointment(null);
    setError(null);
    setDeviceStatus("idle");
    await goToStep("identification", {
      patientType: null,
      patientId: null,
      appointmentId: null,
    });
  }, [goToStep]);

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
    (
      result: {
        patientId: number;
        appointmentId: number;
        chartNumber: string;
        patientName: string;
        startAt: string;
        doctorName: string;
        modality: string;
      },
      type: "new" | "returning",
      extra?: Partial<PatientPayload>,
    ) => {
      setPatient({
        id: result.patientId,
        chartNumber: result.chartNumber,
        name: result.patientName,
        hasKioskLogin: extra?.hasKioskLogin,
        birthDate: extra?.birthDate,
        sex: extra?.sex,
        phone: extra?.phone,
        email: extra?.email,
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
        const rawStep = restoredStep;
        // "analysis" es transitorio: si recargan a mitad, no dejar la UI en "Procesando…"
        if (restoredStep === "analysis") {
          restoredStep = "summary";
          await kioskApi.patchSession({ currentStep: "summary" });
        }
        // "clinical" era un paso único; ahora se divide en síntomas / antecedentes / consentimiento.
        if (restoredStep === "clinical") {
          restoredStep = "symptoms";
          await kioskApi.patchSession({ currentStep: "symptoms" });
        }
        // La videoconsulta NO corre en el kiosk táctil (sin cámara/mic).
        // Si quedó en "consultation" por una sesión vieja, volver a espera con instrucciones.
        if (restoredStep === "consultation") {
          restoredStep = "waiting";
          await kioskApi.patchSession({ currentStep: "waiting" });
        }
        const restoredStatus = data.session.deviceStatus ?? "idle";
        const assessmentRestored = data.session.assessmentDraft as
          | (AssessmentPayload & { callEnded?: boolean })
          | null
          | undefined;
        const callEndedFlag =
          restoredStatus === "call_ended" || assessmentRestored?.callEnded === true;
        // Solo “terminó” si la sesión está cerrada, o si la teleconsulta acabó
        // estando en espera/consulta. No expulsar a bienvenida a mitad de signos/prep.
        const postConsultStep =
          restoredStep === "waiting" ||
          rawStep === "consultation" ||
          restoredStep === "result";
        const sessionDone =
          data.session.status === "completed" ||
          data.session.status === "abandoned" ||
          (callEndedFlag && postConsultStep);
        if (sessionDone) {
          setStep("welcome");
          setVoiceEnabled(false);
        } else if (restoredStep !== "welcome") {
          setStep(restoredStep);
          setVoiceEnabled(true);
        }
        setPatientType((data.session.patientType as "new" | "returning") ?? null);
        setAppointmentId(data.session.appointmentId ?? null);
        setVitalsDraft(data.session.vitalsDraft ?? {});
        // "reading" persistido ocultaba el botón de oxímetro para siempre.
        setDeviceStatus(restoredStatus === "reading" ? "waiting" : restoredStatus);
        setClinical(clinicalFromDraft(data.session.clinicalDraft));
        const draft = data.session.clinicalDraft as Record<string, unknown> | null | undefined;
        if (draft?.crisisIntent === true || draft?.crisisMode === true) {
          setCrisisIntent(true);
          crisisIntentRef.current = true;
        }
        if (
          !sessionDone &&
          restoredStep === "waiting" &&
          (draft?.crisisMode === true ||
            assessmentRestored?.redFlags?.includes("Modo crisis estación"))
        ) {
          setCrisisMode(true);
        }
        if (assessmentRestored) setAssessment(assessmentRestored);
        setPaymentStatus(data.session.paymentStatus ?? "unpaid");
        if (data.paymentOrder) {
          setPaymentOrder(data.paymentOrder);
          setPaymentStatus(data.paymentOrder.status);
        } else if (restoredStep === "payment" && !sessionDone) {
          // Sesión en pago sin orden recuperable: vuelve a elegir servicio
          setStep("service");
          await kioskApi.patchSession({ currentStep: "service" });
        }
        if (data.patient) {
          setPatient(data.patient);
          setDataConfirmed(true);
          if (data.patient.email?.includes("@")) {
            setReceiptEmail(data.patient.email.trim().toLowerCase());
          }
          // El nombre del alta debe servir para firmar el consentimiento.
          const patientName = data.patient.name?.trim();
          if (patientName) {
            setClinical((c) =>
              c.consentSignerName.trim() ? c : { ...c, consentSignerName: patientName },
            );
          }
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

  /** Retorno legacy de Stripe (?stripe=success|cancel&session_id=…). */
  useEffect(() => {
    if (!sessionReady || stripeReturnHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const stripeFlag = params.get("stripe");
    const checkoutSessionId = params.get("session_id");

    if (stripeFlag === "cancel") {
      stripeReturnHandledRef.current = true;
      window.history.replaceState({}, "", "/estacion/paciente");
      setError("Pago cancelado. Puede generar un nuevo código QR.");
      return;
    }

    if (stripeFlag !== "success" || !checkoutSessionId) return;
    stripeReturnHandledRef.current = true;

    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const result = await kioskApi.verifyStripeCheckout(checkoutSessionId);
        window.history.replaceState({}, "", "/estacion/paciente");
        if (!result.paid || !result.order) {
          setError("El pago aún no se confirma en Stripe. Espere un momento e intente de nuevo.");
          return;
        }
        setStripePay(null);
        setPaymentOrder(result.order);
        setPaymentStatus(result.order.status);
        await continueAfterPaymentApproved(result.order, crisisIntentRef.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo confirmar el pago con Stripe");
      } finally {
        setBusy(false);
      }
    })();
  }, [sessionReady]);

  /** Mientras hay QR de Stripe: el kiosco espera a que el celular complete el pago. */
  useEffect(() => {
    if (!stripePay?.sessionId || step !== "payment") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await kioskApi.verifyStripeCheckout(stripePay.sessionId);
        if (cancelled) return;
        if (result.paid && result.order) {
          setStripePay(null);
          setPaymentOrder(result.order);
          setPaymentStatus(result.order.status);
          setBusy(true);
          try {
            await continueAfterPaymentApproved(result.order, crisisIntentRef.current);
          } finally {
            setBusy(false);
          }
        }
      } catch {
        /* reintento en el siguiente intervalo */
      }
    };
    const timer = setInterval(() => void tick(), 2500);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stripePay?.sessionId, step]);

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

  // Modo crisis: solo voz de calma (sin empalme con el script del paso).
  // Continúa hasta que el médico entre realmente a la videollamada.
  useEffect(() => {
    if (!crisisMode || step !== "waiting" || doctorJoined) return;
    let cancelled = false;
    let index = 0;
    let pauseTimer = 0;

    stopKioskVoice();

    const speakNext = () => {
      if (cancelled || doctorJoinedRef.current) return;
      speakKiosk(CRISIS_CALM_SCRIPTS[index % CRISIS_CALM_SCRIPTS.length], {
        force: true,
        onEnd: () => {
          if (cancelled || doctorJoinedRef.current) return;
          index += 1;
          pauseTimer = window.setTimeout(speakNext, 2800);
        },
      });
    };

    const first = window.setTimeout(speakNext, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearTimeout(pauseTimer);
      stopKioskVoice();
    };
  }, [crisisMode, step, doctorJoined]);

  // Historial de salud página 2 (medicamentos): guía hablada al cambiar de subpantalla.
  useEffect(() => {
    if (step !== "antecedents" || antePage !== 2 || !voiceEnabled || crisisMode) return;
    const t = window.setTimeout(() => {
      speakKiosk(ANTECEDENTS_PAGE2_VOICE, { force: true });
    }, 450);
    return () => {
      window.clearTimeout(t);
    };
  }, [step, antePage, voiceEnabled, crisisMode]);

  // Signos vitales: avisar en voz cuando termina cada medición (y devolver equipo si aplica).
  const vitalAwaitingDoneRef = useRef(false);
  useEffect(() => {
    if (!VITAL_STEPS.includes(step)) {
      vitalAwaitingDoneRef.current = false;
      return;
    }
    vitalAwaitingDoneRef.current = !vitalsCompleteForStep(step, vitalsDraft);
  }, [step]);

  useEffect(() => {
    if (!VITAL_STEPS.includes(step) || !voiceEnabled || crisisMode) return;
    if (!vitalsCompleteForStep(step, vitalsDraft)) return;
    if (!vitalAwaitingDoneRef.current) return;
    // Continuar sin ECG no debe decir que «terminó» la medición.
    if (step === "ecg" && vitalsDraft.ecgStatus === "skipped") {
      vitalAwaitingDoneRef.current = false;
      return;
    }
    vitalAwaitingDoneRef.current = false;
    const script = VITAL_DONE_VOICE[step];
    if (script) speakKiosk(script, { force: true });
  }, [step, vitalsDraft, voiceEnabled, crisisMode]);

  // Solo cuando el médico ya está en la llamada Daily: cortar YA (sin frase extra).
  useEffect(() => {
    if (!doctorJoined || calmSilencedRef.current) return;
    calmSilencedRef.current = true;
    doctorJoinedRef.current = true;
    stopKioskVoice();
    setCrisisMode(false);
  }, [doctorJoined]);

  useEffect(() => {
    if (step !== "waiting") return;
    const timer = setInterval(async () => {
      try {
        const data = await kioskApi.getSession();
        if (data.appointment?.meetingUrl) {
          setAppointment(data.appointment);
        }
        const draft = data.session?.assessmentDraft as
          | (AssessmentPayload & {
              doctorPresent?: boolean;
              videoOpened?: boolean;
              callEnded?: boolean;
            })
          | null
          | undefined;
        if (data.session?.deviceStatus === "doctor_live" || draft?.doctorPresent === true) {
          doctorJoinedRef.current = true;
          stopKioskVoice();
          setDoctorJoined(true);
        }
        if (
          data.session?.deviceStatus === "call_ended" ||
          data.session?.status === "completed" ||
          draft?.callEnded === true
        ) {
          if (endingCallRef.current) return;
          endingCallRef.current = true;
          setCallEnded(true);
          setCrisisMode(false);
          stopKioskVoice();
          speakKiosk(TELECONSULTA_ENDED_VOICE, { force: true });
          // Volver a inicio YA (antes esperaba 5s y se sentía “colgado”).
          window.setTimeout(() => {
            void resetKiosk().finally(() => {
              endingCallRef.current = false;
            });
          }, 700);
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [step]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    setVoiceEnabled(true);
    try {
      // Asegura no arrastrar paciente/vitals de una sesión anterior en memoria.
      setPatient(null);
      setAppointment(null);
      setAppointmentId(null);
      setPatientType(null);
      setVitalsDraft({});
      setClinical(emptyClinical());
      setRegistrationDraft(emptyRegistrationDraft());
      setLoginDraft(emptyLoginDraft());
      setLookupDraft(emptyLookupDraft());
      setProfileDraft(emptyProfileDraft());
      setAssessment(null);
      setSelectedService(null);
      setPaymentOrder(null);
      setPaymentStatus("unpaid");
      setReceiptEmail("");
      setStripePay(null);
      setDataConfirmed(false);
      setDeviceStatus("idle");
      setOxygenStatus("");
      setOxygenCapturing(false);
      setCrisisMode(false);
      setCrisisIntent(false);
      setCallEnded(false);
      setDoctorJoined(false);
      setIdMode("choose");
      setRegPage(1);
      setAntePage(1);
      endingCallRef.current = false;
      await kioskApi.startSession();
      await goToStep("service");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  /** Ayuda urgente: pago directo de consulta general → teleconsulta. */
  async function handleCrisis() {
    setBusy(true);
    setError(null);
    setCrisisIntent(true);
    setCrisisMode(false);
    setDoctorJoined(false);
    setCallEnded(false);
    calmSilencedRef.current = false;
    endingCallRef.current = false;
    stopKioskVoice();
    setVoiceEnabled(true);
    setReceiptEmail("");
    setStripePay(null);
    setPaymentOrder(null);
    setPaymentStatus("unpaid");
    setRegistrationDraft(emptyRegistrationDraft());
    try {
      await kioskApi.startSession();
      await kioskApi.patchSession({
        clinicalDraft: {
          crisisIntent: true,
          chiefComplaint: "Ayuda urgente — pendiente de pago",
        },
      });

      let catalog = services;
      if (catalog.length === 0) {
        const listed = await kioskApi.listServices();
        catalog = listed.services;
        setServices(catalog);
      }
      const general =
        catalog.find((s) => s.code === "consulta_general") ?? catalog[0];
      if (!general) {
        throw new Error(
          "No hay servicio de consulta general configurado. Avise al personal de la estación.",
        );
      }

      setSelectedService(general);
      const { order } = await kioskApi.createPayment(general.id);
      setPaymentOrder(order);
      setPaymentStatus(order.status);
      speakKiosk(CRISIS_PAY_FIRST_VOICE, { force: true });
      await goToStep("payment");
    } catch (e) {
      setCrisisIntent(false);
      setSelectedService(null);
      setPaymentOrder(null);
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo pedir ayuda urgente. Avise al personal de la estación.",
      );
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

  async function continueAfterPaymentApproved(
    order: PaymentOrder,
    forCrisis: boolean,
  ) {
    setPaymentOrder(order);
    setPaymentStatus(order.status);
    const paidEmail = receiptEmail.trim().toLowerCase();
    if (paidEmail.includes("@")) {
      setRegistrationDraft((d) => ({ ...d, email: d.email.trim() ? d.email : paidEmail }));
    }
    if (forCrisis) {
      setCrisisMode(true);
      stopKioskVoice();
      const crisisResult = await kioskApi.crisis();
      setPatient(null);
      setPatientType("new");
      setAppointmentId(crisisResult.appointmentId);
      setAssessment(crisisResult.assessment);
      setStep("waiting");
      return;
    }
    setIdMode("choose");
    setPatientType("new");
    setRegPage(1);
    await goToStep("identification");
  }

  /** Pago real con tarjeta: genera Checkout + QR para pagar en el celular (sin teclado en el kiosco). */
  async function payWithStripe() {
    if (!paymentOrder) return;
    const email = receiptEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Escriba su correo electrónico (use el teclado táctil). Ahí le enviaremos el recibo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url, alreadyPaid, checkoutSessionId } = await kioskApi.createStripeCheckout(
        paymentOrder.id,
        email,
      );
      if (alreadyPaid) {
        await continueAfterPaymentApproved(
          { ...paymentOrder, status: "approved" },
          crisisIntent,
        );
        return;
      }
      if (!url || !checkoutSessionId) {
        throw new Error("Stripe no devolvió URL de pago");
      }
      const QRCode = (await import("qrcode")).default;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 420,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setStripePay({ url, sessionId: checkoutSessionId, qrDataUrl });
      speakKiosk(STRIPE_QR_WAITING_VOICE, { force: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el pago con Stripe");
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
      await continueAfterPaymentApproved(result.order, crisisIntent);
    } catch (e) {
      if (crisisIntent) setCrisisMode(false);
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
    try {
      const { patient: found } = await kioskApi.lookup({
        chartNumber: lookupDraft.chartNumber,
        phone: lookupDraft.phone,
        email: lookupDraft.email,
        curp: lookupDraft.curp,
      });
      const visit = await kioskApi.startWalkIn(found.id);
      applyVisit(visit, "returning", {
        hasKioskLogin: Boolean(found.hasKioskLogin),
        birthDate: found.birthDate,
        sex: found.sex,
        phone: found.phone,
        email: found.email,
      });
      setProfileDraft(emptyProfileDraft());
      await kioskApi.patchSession({
        patientId: visit.patientId,
        appointmentId: visit.appointmentId,
        patientType: "returning",
        clinicalDraft: {
          ...clinical,
          consentSignerName: visit.patientName,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No encontrado");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Clic fantasma tras avanzar al paso 3 (Continuar → Crear expediente en el mismo lugar).
    if (Date.now() < blockRegisterSubmitUntilRef.current) {
      return;
    }
    const draft = registrationDraft;
    const page = regPageRef.current;
    // Enter / teclado virtual no debe saltarse el paso de usuario y contraseña.
    if (page === 1) {
      if (!draft.firstName.trim() || !draft.lastNamePaternal.trim()) {
        failWithVoice("Escriba su nombre y apellido paterno para continuar.");
        return;
      }
      goRegPage(2);
      return;
    }
    if (page === 2) {
      if (!draft.phone.trim()) {
        failWithVoice("Escriba su teléfono para continuar.");
        return;
      }
      const email = draft.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failWithVoice("El correo electrónico es obligatorio. Escríbalo para enviarle su receta.");
        return;
      }
      setReceiptEmail(email);
      goRegPage(3);
      return;
    }

    setBusy(true);
    setError(null);
    const birthDate =
      draft.birthYear && draft.birthMonth && draft.birthDay
        ? `${draft.birthYear}-${String(draft.birthMonth).padStart(2, "0")}-${String(draft.birthDay).padStart(2, "0")}`
        : undefined;
    try {
      const result = await kioskApi.register({
        firstName: draft.firstName,
        lastNamePaternal: draft.lastNamePaternal,
        lastNameMaternal: draft.lastNameMaternal || undefined,
        birthDate,
        sex: draft.sex || undefined,
        phone: draft.phone || undefined,
        email: draft.email || undefined,
        emergencyContactName: draft.emergencyContactName || undefined,
        emergencyContactPhone: draft.emergencyContactPhone || undefined,
        kioskUsername: draft.kioskUsername || undefined,
        kioskPassword: draft.kioskPassword || undefined,
      });
      applyVisit(result, "new", {
        hasKioskLogin: Boolean(
          draft.kioskUsername.trim() && draft.kioskPassword.length >= 4,
        ),
      });
      setRegistrationDraft(emptyRegistrationDraft());
      setRegPage(1);
      await kioskApi.patchSession({
        patientId: result.patientId,
        appointmentId: result.appointmentId,
        patientType: "new",
        clinicalDraft: {
          ...clinical,
          consentSignerName: result.patientName,
        },
      });
      if (await finishEditAndReturn()) return;
      await goToStep("symptoms");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar";
      failWithVoice(msg);
    } finally {
      setBusy(false);
    }
  }

  /** Reingreso con usuario y contraseña: recupera antecedentes y salta a síntomas. */
  async function handleKioskLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await kioskApi.login(loginDraft.username, loginDraft.password);
      applyVisit(result, "returning");
      setPatient({
        ...result.patient,
        hasKioskLogin: true,
      });
      setClinical((prev) => ({
        ...clinicalWithAntecedents(prev, result.antecedents),
        consentSignerName: result.patientName,
      }));
      setLoginDraft(emptyLoginDraft());
      const paidOrPatientEmail = (
        result.patient.email?.includes("@")
          ? result.patient.email
          : receiptEmail
      )
        ?.trim()
        .toLowerCase();
      if (paidOrPatientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidOrPatientEmail)) {
        if (!result.patient.email?.includes("@")) {
          await kioskApi.setPatientEmail(paidOrPatientEmail);
          setPatient((prev) => (prev ? { ...prev, email: paidOrPatientEmail } : prev));
        }
        setReceiptEmail(paidOrPatientEmail);
      } else {
        failWithVoice(
          "Necesitamos su correo para enviarle la receta. Use Ya tengo expediente y escríbalo, o regrese al pago.",
        );
        return;
      }
      await kioskApi.patchSession({
        patientId: result.patientId,
        appointmentId: result.appointmentId,
        patientType: "returning",
        clinicalDraft: {
          ...clinicalWithAntecedents(clinical, result.antecedents),
          consentSignerName: result.patientName,
        },
      });
      await goToStep("symptoms");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo entrar con ese usuario";
      failWithVoice(msg);
    } finally {
      setBusy(false);
    }
  }

  /** Síntomas completos: valida antes de pasar a antecedentes. */
  async function continueFromSymptoms() {
    const gaps = getSymptomSelectionGaps(clinical.symptomSelection);
    if (gaps.length > 0 || !isSymptomSelectionComplete(clinical.symptomSelection)) {
      failClinical(
        gaps.length > 0
          ? gaps.join(". ")
          : "Cuéntenos qué siente: elija sus síntomas y, en cada uno, la intensidad y desde cuándo.",
        true,
      );
      document.getElementById("symptom-detail-section")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    const chiefComplaint = buildChiefComplaintFromSelection(clinical.symptomSelection);
    if (chiefComplaint.trim().length < 3) {
      failClinical("Elija al menos un síntoma para continuar.", true);
      return;
    }
    const next = {
      ...clinical,
      chiefComplaint,
      consentSignerName: clinical.consentSignerName.trim() || patient?.name?.trim() || "",
    };
    setClinical(next);
    if (await finishEditAndReturn({ clinicalDraft: next })) return;
    await goToStep("antecedents", { clinicalDraft: next });
  }

  async function continueFromAntecedents() {
    if (clinical.hasAllergies && clinical.allergyDetails.trim().length < 2) {
      failClinical("Escriba a qué medicamentos es alérgico, para cuidarle mejor.");
      return;
    }
    const signerName = clinical.consentSignerName.trim() || patient?.name?.trim() || "";
    const next = { ...clinical, consentSignerName: signerName };
    setClinical(next);
    await goToStep("consent", { clinicalDraft: next });
  }

  async function submitClinical() {
    if (!appointmentId || !patientType) {
      failClinical(
        "Falta la sesión de la cita. Vuelve a Identificación/Datos o reinicia la estación.",
      );
      return;
    }

    const symptomGaps = getSymptomSelectionGaps(clinical.symptomSelection);
    const chiefComplaint = buildChiefComplaintFromSelection(clinical.symptomSelection);
    if (
      symptomGaps.length > 0 ||
      !isSymptomSelectionComplete(clinical.symptomSelection) ||
      chiefComplaint.trim().length < 3
    ) {
      // El detalle se corrige en la pantalla de síntomas: vuelve allí y explica.
      await goToStep("symptoms");
      failClinical(
        symptomGaps.length > 0
          ? symptomGaps.join(" · ")
          : "Complete cada síntoma: intensidad y desde cuándo.",
        true,
      );
      return;
    }
    if (!clinical.consentAccepted || clinical.consentSignerName.trim().length < 3) {
      failClinical(
        !clinical.consentAccepted
          ? "Marque la casilla del consentimiento informado para continuar."
          : "Escriba su nombre completo para el consentimiento (mínimo 3 letras).",
      );
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
        symptomSelection: clinical.symptomSelection,
        clinicalSnapshot: clinicalPayload,
        hasDiabetes: clinical.hasDiabetes,
        diabetesDetails: clinical.hasDiabetes ? "Reportado en estación" : undefined,
        hasHypertension: clinical.hasHypertension,
        hypertensionDetails: clinical.hasHypertension ? "Reportado en estación" : undefined,
        hasAsthma: clinical.hasAsthma,
        hasHeartDisease: clinical.hasHeartDisease,
        heartDiseaseDetails: clinical.hasHeartDisease ? "Reportado en estación" : undefined,
        hasAllergies: clinical.hasAllergies,
        allergyDetails: clinical.hasAllergies ? clinical.allergyDetails || "Reportado en estación" : undefined,
        hasSurgeries: false,
        currentMedications: clinical.currentMedications,
        otherChronicConditions: clinical.hasAsthma ? "Asma" : undefined,
        smokingStatus: "never",
        alcoholUse: "none",
        source: "kiosk",
      });
      setClinical(clinicalPayload);
      await kioskApi.patchSession({ clinicalDraft: clinicalPayload });
      await goToStep("preparation");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar el historial clínico";
      failClinical(msg);
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
    speakKiosk(OXYGEN_START_VOICE, { force: true });
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

  const captureScale = useCallback(async () => {
    if (scaleCaptureLock.current) return;
    scaleCaptureLock.current = true;
    setError(null);
    setScaleCapturing(true);
    setDeviceStatus("reading");
    setScaleStatus("Iniciando lectura de la báscula…");
    speakKiosk(SCALE_MOUNT_VOICE, { force: true });
    try {
      const sample = await readStationScale((msg) => setScaleStatus(msg));
      const patch: VitalsDraft = {
        weight: sample.weightKg.toFixed(1),
        height: sample.heightM.toFixed(2),
        bmi: sample.bmi.toFixed(1),
      };
      setVitalsDraft((prev) => ({ ...prev, ...patch }));
      await kioskApi.patchVitals(patch, "done");
      setDeviceStatus("done");
      setScaleStatus(
        `${sample.weightKg.toFixed(1)} kg · ${(sample.heightM * 100).toFixed(1)} cm · IMC ${sample.bmi.toFixed(1)}`,
      );
    } catch (err) {
      setDeviceStatus("retry");
      const msg = err instanceof Error ? err.message : "No se pudo leer la báscula";
      setScaleStatus(msg);
      setError(msg);
    } finally {
      setScaleCapturing(false);
      scaleCaptureLock.current = false;
    }
  }, []);

  const captureBp = useCallback(async () => {
    if (bpCaptureLock.current) {
      await confirmStationBpDone();
      return;
    }
    bpCaptureLock.current = true;
    setError(null);
    setBpCapturing(true);
    setDeviceStatus("reading");
    setBpStatus("Cable puesto. Coloque el brazalete y pulse inicio en el aparato…");
    speakKiosk(BP_START_VOICE, { force: true });
    try {
      const sample = await readStationBp((msg) => setBpStatus(msg));
      const patch: VitalsDraft = {
        systolicPressure: String(sample.systolic),
        diastolicPressure: String(sample.diastolic),
        ...(sample.heartRate ? { heartRate: String(sample.heartRate) } : {}),
      };
      setVitalsDraft((prev) => ({ ...prev, ...patch }));
      await kioskApi.patchVitals(patch, "done");
      setDeviceStatus("done");
      setBpStatus(
        `${sample.systolic}/${sample.diastolic} mmHg${sample.heartRate ? ` · FC ${sample.heartRate}` : ""}`,
      );
    } catch (err) {
      setDeviceStatus("retry");
      const msg = err instanceof Error ? err.message : "No se pudo leer la presión";
      setBpStatus(msg);
      setError(msg);
    } finally {
      setBpCapturing(false);
      bpCaptureLock.current = false;
    }
  }, []);

  const captureEcg = useCallback(async () => {
    if (ecgCaptureLock.current) {
      await confirmStationEcgDone();
      return;
    }
    ecgCaptureLock.current = true;
    setError(null);
    setEcgCapturing(true);
    setDeviceStatus("reading");
    setEcgStatusMsg("Cable puesto. Ponga los dedos en las placas…");
    speakKiosk(ECG_START_VOICE, { force: true });
    try {
      const sample = await readStationEcg((msg) => setEcgStatusMsg(msg));
      const patch: VitalsDraft = {
        ecgStatus: "done",
        ecgRhythm: sample.rhythm,
        ecgHeartRate: String(sample.heartRate),
        heartRate: String(sample.heartRate),
      };
      setVitalsDraft((prev) => ({ ...prev, ...patch }));
      await kioskApi.patchVitals(patch, "done");
      setDeviceStatus("done");
      setEcgStatusMsg(`${sample.rhythm} · FC ${sample.heartRate} lpm`);
    } catch (err) {
      setDeviceStatus("retry");
      const msg = err instanceof Error ? err.message : "No se pudo leer el ECG";
      setEcgStatusMsg(msg);
      setError(msg);
    } finally {
      setEcgCapturing(false);
      ecgCaptureLock.current = false;
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

  // Al entrar a peso/altura sin lectura, idle.
  useEffect(() => {
    if (step !== "weight_height") return;
    if (vitalsDraft.weight && vitalsDraft.height) {
      setDeviceStatus("done");
      return;
    }
    setScaleCapturing(false);
    setDeviceStatus("idle");
    setScaleStatus("Pulsa el botón verde «Leer báscula ahora».");
  }, [step, vitalsDraft.weight, vitalsDraft.height]);

  useEffect(() => {
    if (step !== "blood_pressure") return;
    if (vitalsDraft.systolicPressure && vitalsDraft.diastolicPressure) {
      setDeviceStatus("done");
      return;
    }
    setBpCapturing(false);
    setDeviceStatus("idle");
    setBpStatus("Pulsa el botón verde «Leer presión ahora».");
  }, [step, vitalsDraft.systolicPressure, vitalsDraft.diastolicPressure]);

  // Al entrar a ECG sin lectura, idle (no bloquear con reading de sesión vieja).
  useEffect(() => {
    if (step !== "ecg") return;
    if (vitalsDraft.ecgStatus) {
      setDeviceStatus("done");
      return;
    }
    setEcgCapturing(false);
    setDeviceStatus("idle");
    setEcgStatusMsg("Toque Leer electrocardiograma cuando esté listo.");
  }, [step, vitalsDraft.ecgStatus]);

  // Revisar consistencia de dispositivos al llegar al resumen.
  useEffect(() => {
    if (step !== "summary") return;
    void import("@/lib/kiosk/device-health").then(({ checkVitalsConsistency }) => {
      const issue = checkVitalsConsistency(vitalsDraft);
      if (issue) {
        speakKiosk(
          `Nota: detectamos una posible inconsistencia en ${issue.device}. Si algo se siente raro, avise al personal para revisión del equipo.`,
        );
      }
    });
  }, [step, vitalsDraft]);

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
    // Limpiar UI de inmediato (aunque falle la API) para “Imprimir y finalizar”.
    const clearLocal = () => {
      setStep("welcome");
      setPatient(null);
      setAppointment(null);
      setAppointmentId(null);
      setPatientType(null);
      setVitalsDraft({});
      setClinical(emptyClinical());
      setRegistrationDraft(emptyRegistrationDraft());
      setLoginDraft(emptyLoginDraft());
      setLookupDraft(emptyLookupDraft());
      setProfileDraft(emptyProfileDraft());
      setAssessment(null);
      setSelectedService(null);
      setPaymentOrder(null);
      setPaymentStatus("unpaid");
      setReceiptEmail("");
      setStripePay(null);
      setDataConfirmed(false);
      setClinicalError(null);
      setEditReturnStep(null);
      setHighlightSymptomGaps(false);
      setDeviceStatus("idle");
      setOxygenStatus("");
      setOxygenCapturing(false);
      setVoiceEnabled(false);
      setCrisisMode(false);
      setCrisisIntent(false);
      setCallEnded(false);
      setDoctorJoined(false);
      calmSilencedRef.current = false;
      doctorJoinedRef.current = false;
      endingCallRef.current = false;
      setIdMode("choose");
      setRegPage(1);
      setAntePage(1);
      stopKioskVoice();
    };
    try {
      await kioskApi.resetSession();
    } catch (e) {
      console.warn("[kiosk] resetSession", e);
    } finally {
      clearLocal();
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
      voiceMuted={voiceMuted}
      onToggleVoice={toggleVoice}
      onNewSession={() => {
        if (
          typeof window !== "undefined" &&
          !window.confirm(
            "¿Terminar esta atención y volver al inicio? Se perderá el progreso actual.",
          )
        ) {
          return;
        }
        void resetKiosk();
      }}
    >
      {error && step !== "summary" && <KioskError message={error} />}

      {step === "welcome" && (
        <KioskCard className="justify-between gap-4 !p-4 sm:!p-6">
          <div className="min-h-0 shrink space-y-3 overflow-hidden">
            <div>
              <BrandLogo width={200} priority className="mb-2" />
              <h2 className={kioskTitleClassName}>Estación virtual 24/7</h2>
              {!sessionReady ? (
                <p className={`mt-2 ${kioskHelperClassName}`}>Cargando estación…</p>
              ) : (
                <p className={kioskSubtitleClassName}>
                  Para empezar su atención médica, toque el botón azul grande de abajo.
                </p>
              )}
            </div>

            <div>
              <p className={`mb-2 ${kioskHelperClassName}`}>
                Así será su visita (solo información — no se toca):
              </p>
              <ol className="grid min-h-0 grid-cols-3 gap-3">
                {[
                  { n: "1", title: "Elija y pague", desc: "Servicio + pago con QR en su celular." },
                  { n: "2", title: "Cuéntenos", desc: "Datos, síntomas y signos vitales." },
                  { n: "3", title: "Atención", desc: "Indicaciones o videoconsulta." },
                ].map((item) => (
                  <li
                    key={item.n}
                    aria-hidden="true"
                    className="pointer-events-none select-none flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-4"
                  >
                    <p className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-2xl font-bold text-slate-600">
                      {item.n}
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-800 xl:text-2xl">{item.title}</p>
                    <p className="mt-1 text-base leading-snug text-slate-600 xl:text-lg">{item.desc}</p>
                  </li>
                ))}
              </ol>
            </div>

            <KioskInfo>
              <strong>Importante:</strong> escuche la <strong>bocina</strong> y hable al{" "}
              <strong>micrófono fijo</strong> (sin audífonos).
            </KioskInfo>

            {patient ? (
              <KioskImportant>
                Sesión anterior de <strong>{patient.name}</strong>. Use Nueva atención para
                empezar de cero.
              </KioskImportant>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 border-t-2 border-[#1d6eb8]/25 bg-[#f0f7ff]/80 pt-3 -mx-4 px-4 sm:-mx-5 sm:px-5 pb-1">
            <p className="text-center text-3xl font-bold leading-tight text-[#0f3d66] xl:text-4xl">
              ↓ Toque aquí para comenzar ↓
            </p>
            <KioskPrimaryButton
              disabled={busy || !sessionReady}
              onClick={handleStart}
            >
              Iniciar atención
            </KioskPrimaryButton>
            {patient ? (
              <KioskSecondaryButton
                className="w-full"
                disabled={busy}
                onClick={() => void resetKiosk()}
              >
                Nueva atención
              </KioskSecondaryButton>
            ) : null}
            <CrisisButton
              tone="soft"
              disabled={busy || !sessionReady}
              onClick={() => void handleCrisis()}
            />
          </div>
        </KioskCard>
      )}

      {step === "service" && (
        <KioskCard>
          <h2 className={kioskTitleClassName}>Selecciona el servicio</h2>
          <p className={kioskSubtitleClassName}>
            Revisa el precio y las condiciones. El cobro se realiza antes de iniciar la atención clínica.
          </p>
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
              {services.length === 0 && (
                <p className={kioskHelperClassName}>No hay servicios configurados. Contacta a soporte.</p>
              )}
              {services.map((service, index) => {
                const tint =
                  index % 3 === 0
                    ? "border-[#1d6eb8]/25 bg-[#eef5fc]"
                    : index % 3 === 1
                      ? "border-teal-300/40 bg-teal-50/70"
                      : "border-slate-300/80 bg-slate-100/80";
                return (
                <button
                  key={service.id}
                  type="button"
                  disabled={busy}
                  onClick={() => selectService(service)}
                  className={`flex min-h-[88px] w-full flex-1 items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 text-left transition hover:border-[#1d6eb8]/60 hover:brightness-[0.98] active:scale-[0.99] disabled:opacity-60 xl:min-h-[96px] ${tint}`}
                >
                  <div className="min-w-0">
                    <p className="text-2xl font-bold leading-tight text-slate-900 xl:text-3xl">
                      {service.name}
                    </p>
                    {service.description ? (
                      <p className="mt-1 text-lg leading-snug text-slate-600 xl:text-xl">
                        {service.description}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-2xl font-bold text-[#1d6eb8] xl:text-3xl">
                    {formatMoney(service.amountCents, service.currency)}
                  </p>
                </button>
                );
              })}
          </div>
          <div className="mt-3 flex w-full shrink-0 flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap">
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
          <h2 className={kioskTitleClassName}>
            {crisisIntent ? "Pago de urgencia — consulta general" : "Pago con tarjeta"}
          </h2>
          {!stripePay ? (
            crisisIntent ? (
              <KioskImportant className="mt-2 shrink-0 font-semibold">
                Se cobrará la consulta general. Escanee el QR con su celular; al confirmarse el pago se
                dispara la teleconsulta.
              </KioskImportant>
            ) : (
              <KioskImportant className="mt-2 shrink-0 font-semibold">
                Pague escaneando el QR con su celular. Solo con pago aprobado se abre la sesión clínica.
              </KioskImportant>
            )
          ) : null}
          <div className="mt-2 min-h-0 flex-1 overflow-hidden">
          {crisisIntent ? (
            <div className="mb-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-base font-semibold leading-snug text-red-900 sm:text-lg">
              Ayuda urgente: sin pago aprobado no se puede contactar al médico.
            </div>
          ) : null}

          {stripePay ? (
            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0 space-y-2">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border-2 border-[#1d6eb8]/25 bg-[#eef5fc] px-5 py-5 xl:px-6 xl:py-6">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-500 xl:text-xl">Concepto</p>
                    <p className="mt-1.5 text-2xl font-bold leading-snug text-slate-900 xl:text-3xl">
                      {paymentOrder.concept}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-lg font-semibold text-slate-500 xl:text-xl">Importe</p>
                    <p className="mt-1.5 text-4xl font-bold tabular-nums text-[#1d6eb8] xl:text-5xl">
                      {formatMoney(paymentOrder.amountCents, paymentOrder.currency)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-500 xl:text-xl">Referencia</p>
                    <p className="mt-1.5 truncate font-mono text-lg font-semibold text-slate-800 xl:text-xl">
                      {paymentOrder.reference}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-lg font-semibold text-slate-500 xl:text-xl">Estado</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-900 xl:text-3xl">{paymentStatus}</p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-slate-800 xl:text-xl">
                  Escanee con su celular para pagar
                </p>
                <p className={`text-base leading-snug xl:text-lg ${kioskHelperClassName}`}>
                  En el teléfono escriba la tarjeta. Esta pantalla detectará el pago sola.
                </p>
                <p className="text-lg font-semibold text-[#1d6eb8]">Esperando pago…</p>
                <p className="text-base text-slate-600 xl:text-lg">
                  Recibo a: <span className="font-semibold text-slate-900">{receiptEmail}</span>
                </p>
                <KioskSecondaryButton onClick={() => setStripePay(null)} disabled={busy}>
                  Cancelar QR
                </KioskSecondaryButton>
              </div>
              <div className="mx-auto flex shrink-0 justify-center lg:mx-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stripePay.qrDataUrl}
                  alt="Código QR de pago Stripe"
                  className="h-[220px] w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-sm xl:h-[260px] xl:w-[260px]"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid min-h-[160px] grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border-2 border-[#1d6eb8]/25 bg-[#eef5fc] px-5 py-5 xl:min-h-[180px] xl:px-6 xl:py-6">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-500 xl:text-xl">Concepto</p>
                  <p className="mt-1.5 text-2xl font-bold leading-snug text-slate-900 xl:text-3xl">
                    {paymentOrder.concept}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-lg font-semibold text-slate-500 xl:text-xl">Importe</p>
                  <p className="mt-1.5 text-4xl font-bold tabular-nums text-[#1d6eb8] xl:text-5xl">
                    {formatMoney(paymentOrder.amountCents, paymentOrder.currency)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-500 xl:text-xl">Referencia</p>
                  <p className="mt-1.5 truncate font-mono text-lg font-semibold text-slate-800 xl:text-xl">
                    {paymentOrder.reference}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-lg font-semibold text-slate-500 xl:text-xl">Estado</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900 xl:text-3xl">{paymentStatus}</p>
                </div>
              </div>
              <label className={`mt-3 block ${kioskLabelClassName}`}>
                Su correo electrónico *
                <input
                  type="text"
                  inputMode="none"
                  value={receiptEmail}
                  onChange={(e) => {
                    const v = e.target.value;
                    setReceiptEmail(v);
                    setRegistrationDraft((d) => ({ ...d, email: v }));
                  }}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    setReceiptEmail(v);
                    setRegistrationDraft((d) => ({ ...d, email: v }));
                  }}
                  placeholder="ej. juan.perez@gmail.com"
                  className={`mt-2 ${kioskInputClassName}`}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
              <KioskImportant className="mt-3 shrink-0 font-semibold">
                Escriba su correo: le enviaremos el recibo de pago y lo usaremos al registrar sus datos.
                Luego escanee el QR y pague en su celular.
              </KioskImportant>
            </>
          )}
          </div>
          <div className="sticky bottom-[var(--kiosk-keyboard-height,0px)] z-10 mt-3 flex w-full shrink-0 flex-col gap-2 border-t border-slate-100 bg-white/95 pt-3 backdrop-blur sm:flex-row sm:flex-wrap">
            {crisisIntent ? (
              <KioskSecondaryButton
                onClick={async () => {
                  setBusy(true);
                  try {
                    setStripePay(null);
                    await resetKiosk();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                ← Cancelar urgencia
              </KioskSecondaryButton>
            ) : (
              <KioskSecondaryButton
                onClick={() => {
                  setStripePay(null);
                  goBack();
                }}
                disabled={busy}
              >
                ← Cambiar servicio
              </KioskSecondaryButton>
            )}
            {!crisisIntent ? (
              <KioskSecondaryButton
                onClick={async () => {
                  setBusy(true);
                  try {
                    setStripePay(null);
                    await resetKiosk();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                Volver al inicio
              </KioskSecondaryButton>
            ) : null}
            {!stripePay ? (
              <KioskPrimaryButton className="w-full flex-1" onClick={payWithStripe} disabled={busy}>
                {busy
                  ? "Generando código QR…"
                  : crisisIntent
                    ? "Generar QR y pedir teleconsulta"
                    : "Generar QR para pagar"}
              </KioskPrimaryButton>
            ) : null}
            {!stripePay ? (
              <>
                <KioskSecondaryButton onClick={approvePaymentDemo} disabled={busy}>
                  Simular pago (pruebas)
                </KioskSecondaryButton>
                <KioskSecondaryButton onClick={rejectPaymentDemo} disabled={busy}>
                  Simular rechazo
                </KioskSecondaryButton>
              </>
            ) : null}
          </div>
        </KioskCard>
      )}

      {step === "payment" && !paymentOrder && (
        <KioskCard>
          <h2 className={kioskTitleClassName}>Pago no disponible</h2>
          <p className={kioskSubtitleClassName}>
            No se encontró la orden de pago de esta sesión. Puedes elegir el servicio de nuevo o reiniciar.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:flex-wrap">
            <KioskSecondaryButton onClick={goBack} disabled={busy}>
              ← Cambiar servicio
            </KioskSecondaryButton>
            <KioskPrimaryButton
              className="w-full flex-1"
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
          <h2 className={kioskTitleClassName}>Identificación</h2>
          <p className={kioskSubtitleClassName}>Pago confirmado. ¿Cómo desea continuar?</p>

          {idMode === "choose" && (
            <>
              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2.5">
                <BigChoice
                  compact
                  highlight
                  title="Soy paciente nuevo"
                  subtitle="Alta de expediente en este momento"
                  icon="✨"
                  onClick={async () => {
                    setPatientType("new");
                    setRegPage(1);
                    setIdMode("new");
                    const paidEmail = receiptEmail.trim().toLowerCase();
                    if (paidEmail.includes("@")) {
                      setRegistrationDraft((d) => ({
                        ...d,
                        email: d.email.trim() ? d.email : paidEmail,
                      }));
                    }
                    await kioskApi.patchSession({ patientType: "new" });
                    await goToStep("registration");
                  }}
                />
                <BigChoice
                  compact
                  title="Ya tengo expediente"
                  subtitle="Búsqueda por teléfono, correo, CURP o expediente"
                  icon="📋"
                  onClick={async () => {
                    setPatientType("returning");
                    setIdMode("returning");
                    await kioskApi.patchSession({ patientType: "returning" });
                    await goToStep("registration");
                  }}
                />
                <BigChoice
                  compact
                  title="Entrar con usuario y contraseña"
                  subtitle="Si ya creó su perfil en una visita anterior"
                  icon="🔑"
                  onClick={() => setIdMode("login")}
                />
                <BigChoice
                  compact
                  title="Olvidé mi usuario o contraseña"
                  subtitle="Búsquese por teléfono o correo y cree una nueva clave"
                  icon="🔓"
                  onClick={async () => {
                    setPatientType("returning");
                    setIdMode("returning");
                    setPatient(null);
                    setDataConfirmed(false);
                    setProfileDraft(emptyProfileDraft());
                    await kioskApi.patchSession({ patientType: "returning" });
                    await goToStep("registration");
                    speakKiosk(
                      "Busque su expediente con teléfono, correo o número de expediente. Luego podrá crear un usuario y contraseña nuevos.",
                      { force: true },
                    );
                  }}
                />
              </div>
              <div className="mt-3 shrink-0 border-t border-slate-100 pt-3">
                <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
              </div>
            </>
          )}

          {idMode === "login" && (
            <form onSubmit={handleKioskLogin} className="mt-6 grid gap-4 sm:grid-cols-2">
              <p className={`sm:col-span-2 ${kioskBodyClassName}`}>
                Escriba el usuario y la contraseña que creó en su primera visita.
              </p>
              <div>
                <label className={kioskLabelClassName}>Usuario</label>
                <input
                  name="kioskUsername"
                  value={loginDraft.username}
                  onChange={(e) => setLoginDraft((d) => ({ ...d, username: e.target.value }))}
                  {...kioskTextFieldProps}
                  className={kioskInputClassName}
                />
              </div>
              <div>
                <label className={kioskLabelClassName}>Contraseña</label>
                <input
                  name="kioskPassword"
                  type="password"
                  value={loginDraft.password}
                  onChange={(e) => setLoginDraft((d) => ({ ...d, password: e.target.value }))}
                  {...kioskTextFieldProps}
                  className={kioskInputClassName}
                />
              </div>
              <div className="sm:col-span-2 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
                <KioskSecondaryButton type="button" onClick={() => setIdMode("choose")}>
                  ← Atrás
                </KioskSecondaryButton>
                <KioskPrimaryButton className="w-full flex-1" type="submit" disabled={busy}>
                  {busy ? "Entrando…" : "Entrar y continuar"}
                </KioskPrimaryButton>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="w-full rounded-xl border border-[#1d6eb8]/30 bg-[#f0f7ff] px-4 py-3 text-left text-base font-semibold text-[#0b4f8a] active:bg-[#e0efff]"
                  onClick={() => {
                    void (async () => {
                      setPatientType("returning");
                      setIdMode("returning");
                      setPatient(null);
                      setDataConfirmed(false);
                      setProfileDraft(emptyProfileDraft());
                      await kioskApi.patchSession({ patientType: "returning" });
                      await goToStep("registration");
                      speakKiosk(
                        "Busque su expediente con teléfono, correo o número de expediente. Luego podrá crear un usuario y contraseña nuevos.",
                        { force: true },
                      );
                    })();
                  }}
                >
                  ¿Olvidó su usuario o contraseña? → Búsquese y cree una nueva
                </button>
              </div>
            </form>
          )}
        </KioskCard>
      )}

      {step === "registration" && patientType === "returning" && (
        <KioskCard>
          <div className="mb-4">
            <KioskSecondaryButton
              type="button"
              disabled={busy}
              onClick={() => void backToIdentificationChoice()}
            >
              ← Atrás
            </KioskSecondaryButton>
          </div>
          <h2 className={kioskTitleClassName}>Buscar expediente</h2>
          <p className={kioskSubtitleClassName}>
            Ingrese teléfono, correo, CURP o número de expediente. Si olvidó su clave, aquí podrá
            crear un usuario y contraseña nuevos.
          </p>
          <form id="kiosk-lookup-form" onSubmit={handleLookup} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input
              name="chartNumber"
              placeholder="Número de expediente"
              value={lookupDraft.chartNumber}
              onChange={(e) => setLookupDraft((d) => ({ ...d, chartNumber: e.target.value }))}
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <input
              name="phone"
              placeholder="Teléfono"
              value={lookupDraft.phone}
              onChange={(e) => setLookupDraft((d) => ({ ...d, phone: e.target.value }))}
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <input
              name="email"
              placeholder="Correo electrónico"
              value={lookupDraft.email}
              onChange={(e) => setLookupDraft((d) => ({ ...d, email: e.target.value }))}
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
            <input
              name="curp"
              placeholder="CURP"
              value={lookupDraft.curp}
              onChange={(e) => setLookupDraft((d) => ({ ...d, curp: e.target.value }))}
              {...kioskTextFieldProps}
              className={kioskInputClassName}
            />
          </form>
          {patient && (
            <ConfirmDataPanel
              key={patient.id}
              patient={patient}
              confirmed={dataConfirmed}
              onConfirm={setDataConfirmed}
              emailValue={
                (patient.email && patient.email.includes("@")
                  ? patient.email
                  : receiptEmail) || ""
              }
              onEmailChange={(v) => {
                setReceiptEmail(v);
                setPatient((prev) => (prev ? { ...prev, email: v } : prev));
              }}
              profileDraft={profileDraft}
              onProfileDraftChange={setProfileDraft}
              continueLabel={
                editReturnStep === "summary" ? "Guardar y volver a signos vitales" : "Continuar"
              }
              onContinue={async () => {
                const email = (
                  (patient.email && patient.email.includes("@")
                    ? patient.email
                    : receiptEmail) || ""
                )
                  .trim()
                  .toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  failWithVoice(
                    "El correo electrónico es obligatorio para enviarle su receta. Escríbalo para continuar.",
                  );
                  return;
                }
                try {
                  setBusy(true);
                  await kioskApi.setPatientEmail(email);
                  setPatient((prev) => (prev ? { ...prev, email } : prev));
                  setReceiptEmail(email);
                  if (await finishEditAndReturn()) return;
                  await goToStep("symptoms");
                } catch (err) {
                  failWithVoice(err instanceof Error ? err.message : "No se pudo guardar el correo");
                } finally {
                  setBusy(false);
                }
              }}
              onCreateProfile={async (username, password) => {
                await kioskApi.setProfile(username, password);
                setPatient((prev) => (prev ? { ...prev, hasKioskLogin: true } : prev));
                setProfileDraft(emptyProfileDraft());
                speakKiosk(
                  "Listo. Guardamos su usuario para la próxima visita. Puede continuar.",
                  { force: true },
                );
              }}
            />
          )}
          <div className="sticky bottom-[var(--kiosk-keyboard-height,0px)] z-10 -mx-6 mt-5 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <KioskSecondaryButton
                type="button"
                disabled={busy}
                onClick={() => {
                  if (editReturnStep) {
                    void goBack();
                    return;
                  }
                  void backToIdentificationChoice();
                }}
              >
                ← Atrás
              </KioskSecondaryButton>
              {!patient ? (
                <KioskPrimaryButton
                  className="w-full flex-1"
                  type="submit"
                  form="kiosk-lookup-form"
                  disabled={busy}
                >
                  {busy ? "Buscando…" : "Buscar expediente"}
                </KioskPrimaryButton>
              ) : null}
            </div>
          </div>
        </KioskCard>
      )}

      {step === "registration" && patientType === "new" && (
        <KioskCard>
          <h2 className={`shrink-0 ${kioskTitleClassName}`}>Alta de paciente</h2>
          <p className={`mt-2 shrink-0 ${kioskHelperClassName}`}>
            Paso {regPage} de 3 — {regPage === 1 ? "Nombre" : regPage === 2 ? "Contacto" : "Usuario y contraseña"}
          </p>
          <form onSubmit={handleRegister} className="mt-5 flex min-h-0 flex-1 flex-col">
            <KioskScrollArea className="min-h-0 flex-1">
              <div className={regPage === 1 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
                <Field
                  label="Nombre *"
                  name="firstName"
                  required={regPage === 1}
                  value={registrationDraft.firstName}
                  onValueChange={(v) => patchRegistration("firstName", v)}
                />
                <Field
                  label="Apellido paterno *"
                  name="lastNamePaternal"
                  required={regPage === 1}
                  value={registrationDraft.lastNamePaternal}
                  onValueChange={(v) => patchRegistration("lastNamePaternal", v)}
                />
                <Field
                  label="Apellido materno"
                  name="lastNameMaternal"
                  value={registrationDraft.lastNameMaternal}
                  onValueChange={(v) => patchRegistration("lastNameMaternal", v)}
                />
                <BirthDateFields
                  labelClassName={kioskLabelClassName}
                  selectClassName={kioskInputClassName}
                  day={registrationDraft.birthDay}
                  month={registrationDraft.birthMonth}
                  year={registrationDraft.birthYear}
                  onChange={({ day, month, year }) => {
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      birthDay: day,
                      birthMonth: month,
                      birthYear: year,
                    }));
                  }}
                />
                <div>
                  <label className={kioskLabelClassName}>Sexo</label>
                  <select
                    name="sex"
                    className={kioskInputClassName}
                    value={registrationDraft.sex}
                    onChange={(e) => patchRegistration("sex", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
              </div>
              <div className={regPage === 2 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
                <Field
                  label="Teléfono *"
                  name="phone"
                  required={regPage === 2}
                  value={registrationDraft.phone}
                  onValueChange={(v) => patchRegistration("phone", v)}
                />
                <Field
                  label="Correo electrónico *"
                  name="email"
                  type="email"
                  required={regPage === 2}
                  helper="Obligatorio. Aquí le enviaremos su receta."
                  value={registrationDraft.email}
                  onValueChange={(v) => {
                    patchRegistration("email", v);
                    setReceiptEmail(v);
                  }}
                />
                <p className={`sm:col-span-2 mt-2 text-lg font-semibold text-slate-800 sm:text-xl`}>
                  Contacto de emergencia
                </p>
                <Field
                  label="Nombre"
                  name="emergencyContactName"
                  value={registrationDraft.emergencyContactName}
                  onValueChange={(v) => patchRegistration("emergencyContactName", v)}
                />
                <Field
                  label="Teléfono"
                  name="emergencyContactPhone"
                  value={registrationDraft.emergencyContactPhone}
                  onValueChange={(v) => patchRegistration("emergencyContactPhone", v)}
                />
              </div>
              <div className={regPage === 3 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
                <div className="sm:col-span-2 rounded-2xl border-2 border-[#1d6eb8]/30 bg-[#f0f7ff] p-4">
                  <p className="text-2xl font-bold text-slate-900 xl:text-3xl">
                    Cree su usuario y contraseña
                  </p>
                  <p className={`mt-2 ${kioskBodyClassName}`}>
                    Así la próxima vez entra más rápido, sin volver a llenar todo el alta.
                    Si no desea crearlos ahora, deje los campos vacíos y continúe.
                  </p>
                </div>
                <Field
                  label="Usuario"
                  name="kioskUsername"
                  helper="Ejemplo: su nombre o un apodo sencillo"
                  value={registrationDraft.kioskUsername}
                  onValueChange={(v) => patchRegistration("kioskUsername", v)}
                />
                <Field
                  label="Contraseña"
                  name="kioskPassword"
                  type="password"
                  helper="Mínimo 4 caracteres (si crea usuario)"
                  value={registrationDraft.kioskPassword}
                  onValueChange={(v) => patchRegistration("kioskPassword", v)}
                />
              </div>
            </KioskScrollArea>
            <div className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap">
              <KioskSecondaryButton
                type="button"
                onClick={async () => {
                  if (regPage === 1) {
                    if (editReturnStep) {
                      await goBack();
                      return;
                    }
                    // Conserva el borrador del alta al volver a Identificación.
                    await backToIdentificationChoice();
                    return;
                  }
                  goRegPage(regPage === 3 ? 2 : 1);
                }}
              >
                ← Atrás
              </KioskSecondaryButton>
              {regPage < 3 ? (
                <KioskPrimaryButton
                  className="w-full flex-1"
                  type="button"
                  onClick={() => {
                    if (regPage === 1) {
                      if (!registrationDraft.firstName.trim() || !registrationDraft.lastNamePaternal.trim()) {
                        failWithVoice("Escriba su nombre y apellido paterno para continuar.");
                        return;
                      }
                      goRegPage(2);
                      return;
                    }
                    if (!registrationDraft.phone.trim()) {
                      failWithVoice("Escriba su teléfono para continuar.");
                      return;
                    }
                    goRegPage(3);
                  }}
                >
                  Continuar
                </KioskPrimaryButton>
              ) : (
                <KioskPrimaryButton
                  className="w-full flex-1"
                  type="button"
                  disabled={busy}
                  onClick={(e) => {
                    if (Date.now() < blockRegisterSubmitUntilRef.current) return;
                    const form = (e.target as HTMLElement).closest("form");
                    if (!form) return;
                    form.requestSubmit();
                  }}
                >
                  {busy ? "Guardando…" : "Crear expediente y continuar"}
                </KioskPrimaryButton>
              )}
            </div>
          </form>
        </KioskCard>
      )}

      {step === "symptoms" && (
        <KioskCard>
          <h2 className={`shrink-0 ${kioskTitleClassName}`}>¿Qué siente hoy?</h2>
          <p className={`shrink-0 ${kioskSubtitleClassName}`}>
            Toque lo que mejor describa cómo se encuentra. No hay prisa.
          </p>
          <KioskScrollArea className="mt-3">
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
                    setClinicalError(gaps.join(". "));
                  }
                }
              }}
            />
          </KioskScrollArea>
          <ClinicalStepFooter
            message={clinicalError}
            busy={busy}
            onBack={goBack}
            onContinue={() => void continueFromSymptoms()}
            continueLabel={
              editReturnStep === "summary" ? "Guardar y volver a signos vitales" : "Continuar"
            }
          />
        </KioskCard>
      )}

      {step === "antecedents" && (
        <KioskCard>
          <h2 className={`shrink-0 ${kioskTitleClassName}`}>Su historial de salud</h2>
          <p className={`shrink-0 mt-2 ${kioskHelperClassName}`}>
            Paso {antePage} de 2 — {antePage === 1 ? "Condiciones" : "Medicamentos"}
          </p>
          {antePage === 2 ? (
            <>
              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                <label className="shrink-0 text-xl font-semibold text-slate-800 xl:text-2xl">
                  ¿Toma algún medicamento actualmente?
                </label>
                <textarea
                  rows={5}
                  value={clinical.currentMedications}
                  onChange={(e) => setClinical({ ...clinical, currentMedications: e.target.value })}
                  onInput={(e) =>
                    setClinical({
                      ...clinical,
                      currentMedications: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  {...kioskTextFieldProps}
                  className={`${kioskInputClassName} min-h-[140px] flex-1 resize-none scroll-mb-[340px]`}
                  placeholder="Nombre y dosis, si los recuerda. Si no toma ninguno, déjelo vacío."
                />
                <p className={`shrink-0 text-base text-slate-500 xl:text-lg`}>
                  Escriba aquí y toque Listo ✓ en el teclado. Luego Continuar.
                </p>
              </div>
              <ClinicalStepFooter
                message={clinicalError}
                busy={busy}
                onBack={() => setAntePage(1)}
                onContinue={() => void continueFromAntecedents()}
              />
            </>
          ) : (
            <>
              <KioskScrollArea className="mt-3">
                <div className="space-y-3 pb-4">
                  <YesNo label="¿Tiene diabetes?" checked={clinical.hasDiabetes} onChange={(v) => setClinical({ ...clinical, hasDiabetes: v })} />
                  <YesNo label="¿Tiene hipertensión (presión alta)?" checked={clinical.hasHypertension} onChange={(v) => setClinical({ ...clinical, hasHypertension: v })} />
                  <YesNo label="¿Tiene asma?" checked={clinical.hasAsthma} onChange={(v) => setClinical({ ...clinical, hasAsthma: v })} />
                  <YesNo label="¿Tiene alguna enfermedad del corazón?" checked={clinical.hasHeartDisease} onChange={(v) => setClinical({ ...clinical, hasHeartDisease: v })} />
                  <YesNo label="¿Es alérgico a algún medicamento?" checked={clinical.hasAllergies} onChange={(v) => setClinical({ ...clinical, hasAllergies: v })} />
                  {clinical.hasAllergies && (
                    <input
                      value={clinical.allergyDetails}
                      onChange={(e) => {
                        setClinical({ ...clinical, allergyDetails: e.target.value });
                        if (clinicalError) {
                          setClinicalError(null);
                          setError(null);
                        }
                      }}
                      onInput={(e) => {
                        setClinical({
                          ...clinical,
                          allergyDetails: (e.target as HTMLInputElement).value,
                        });
                      }}
                      placeholder="¿A cuáles medicamentos?"
                      {...kioskTextFieldProps}
                      className={`${kioskInputClassName} scroll-mb-[340px]`}
                    />
                  )}
                </div>
              </KioskScrollArea>
              <ClinicalStepFooter
                message={clinicalError}
                busy={busy}
                onBack={() => goBack()}
                onContinue={() => {
                  if (clinical.hasAllergies && !clinical.allergyDetails.trim()) {
                    failClinical("Indique a qué medicamentos es alérgico.");
                    return;
                  }
                  setClinicalError(null);
                  setAntePage(2);
                }}
              />
            </>
          )}
        </KioskCard>
      )}

      {step === "consent" && (
        <KioskCard>
          <h2 className={`shrink-0 ${kioskTitleClassName}`}>Su consentimiento</h2>
          <p className={`shrink-0 ${kioskSubtitleClassName}`}>
            Lea el texto, confirme su nombre y acepte para continuar.
          </p>
          <KioskScrollArea className="mt-3">
            <div className={`rounded-2xl bg-slate-50 p-5 ${kioskBodyClassName}`}>
              {STATION_CONSENT_TEXT}
            </div>
          </KioskScrollArea>
          <div className="mt-3 shrink-0 space-y-3">
            <div>
              <label className={kioskLabelClassName}>Nombre completo</label>
              <input
                value={clinical.consentSignerName}
                onChange={(e) => {
                  setClinical({ ...clinical, consentSignerName: e.target.value });
                  if (clinicalError) {
                    setClinicalError(null);
                    setError(null);
                  }
                }}
                placeholder="Escriba su nombre completo"
                {...kioskTextFieldProps}
                className={kioskInputClassName}
              />
            </div>
            <label
              className={`flex min-h-[88px] cursor-pointer items-center gap-5 rounded-2xl border-2 px-5 py-4 transition xl:min-h-[96px] ${
                clinical.consentAccepted
                  ? "border-[#1d6eb8] bg-[#1d6eb8]/10 shadow-sm"
                  : "border-slate-300 bg-white"
              }`}
            >
              <input
                type="checkbox"
                className="h-10 w-10 shrink-0 rounded-md border-2 border-slate-400 text-[#1d6eb8] focus:ring-[#1d6eb8] xl:h-12 xl:w-12"
                checked={clinical.consentAccepted}
                onChange={(e) => {
                  setClinical({ ...clinical, consentAccepted: e.target.checked });
                  if (clinicalError) {
                    setClinicalError(null);
                    setError(null);
                  }
                }}
              />
              <span className="text-2xl font-bold leading-snug text-slate-900 xl:text-3xl">
                Acepto el consentimiento informado
              </span>
            </label>
          </div>
          <ClinicalStepFooter
            message={clinicalError}
            busy={busy}
            onBack={goBack}
            onContinue={() => void submitClinical()}
            continueLabel={busy ? "Guardando…" : "Acepto y continúo"}
          />
        </KioskCard>
      )}

      {step === "preparation" && (
        <KioskCard className="justify-between gap-3">
          <div className="min-h-0 flex-1 overflow-hidden">
            <h2 className={kioskTitleClassName}>Preparación para signos vitales</h2>
            <p className={kioskSubtitleClassName}>
              Tomaremos sus signos uno por uno. La voz le guiará en cada paso.
            </p>
            <ul className="mt-5 grid grid-cols-5 gap-3">
              {[
                { icon: "scale" as const, label: "Peso y altura" },
                { icon: "🫀", label: "Presión" },
                { icon: "🫁", label: "Oxígeno" },
                { icon: "🌡️", label: "Temp." },
                { icon: "📈", label: "ECG" },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-2 py-4 text-center xl:min-h-[160px]"
                >
                  {item.icon === "scale" ? (
                    <DigitalScaleHeightIcon className="h-14 w-14 xl:h-16 xl:w-16" />
                  ) : (
                    <span className="text-5xl leading-none xl:text-6xl">{item.icon}</span>
                  )}
                  <span className="mt-3 text-lg font-bold leading-tight text-slate-900 xl:text-xl">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 w-full flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <KioskSecondaryButton onClick={goBack}>← Atrás</KioskSecondaryButton>
            <KioskPrimaryButton className="w-full flex-1" onClick={() => goToStep("weight_height")}>
              Continuar
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "weight_height" && (
        <VitalStepScreen
          compact
          stepNumber={1}
          totalSteps={5}
          title="Peso y altura"
          instruction=""
          steps={[...WEIGHT_HEIGHT_VOICE_STEPS]}
          illustration="weight_height"
          deviceStatus={resolveVitalUiStatus(
            deviceStatus,
            Boolean(vitalsDraft.weight && vitalsDraft.height),
          )}
          statusMessage={
            scaleStatus ||
            (vitalsDraft.weight
              ? undefined
              : "Listo para leer — pulse el botón verde de abajo")
          }
          referenceRanges={[
            VITAL_RANGE_COPY.bmi,
            "Tras medir, verá si su IMC está en rango normal",
          ]}
          readingViews={(() => {
            if (!vitalsDraft.weight || !vitalsDraft.height) return undefined;
            const views = [
              interpretWeight(vitalsDraft.weight)!,
              interpretHeight(vitalsDraft.height)!,
            ];
            const bmi = interpretBmi(vitalsDraft.bmi);
            if (bmi) views.push(bmi);
            return views;
          })()}
          onCapture={() => void captureScale()}
          captureLabel="Leer báscula ahora"
          capturingLabel="Esperando peso y altura…"
          capturing={scaleCapturing}
          onSimulate={() => simulateReading({ weight: "81.4", height: "1.76", bmi: "26.3" })}
          onContinue={async () => {
            if (!vitalsDraft.weight || !vitalsDraft.height) {
              failWithVoice("Primero toque el botón verde «Leer báscula ahora».");
              return;
            }
            setError(null);
            setScaleStatus("");
            setDeviceStatus("idle");
            await goToStep("blood_pressure");
          }}
          onBack={goBack}
          onRetry={async () => {
            await clearVitalFields(VITAL_FIELDS.weight_height);
            setScaleStatus("Pulsa Leer báscula ahora");
            setDeviceStatus("idle");
          }}
        />
      )}

      {step === "blood_pressure" && (
        <VitalStepScreen
          compact
          stepNumber={2}
          totalSteps={5}
          title="Presión arterial"
          instruction=""
          steps={[...BLOOD_PRESSURE_VOICE_STEPS]}
          illustration="blood_pressure"
          deviceStatus={resolveVitalUiStatus(
            deviceStatus,
            Boolean(vitalsDraft.systolicPressure && vitalsDraft.diastolicPressure),
          )}
          referenceRanges={[
            VITAL_RANGE_COPY.bloodPressure,
            VITAL_RANGE_COPY.heartRate,
          ]}
          statusMessage={
            bpStatus ||
            (vitalsDraft.systolicPressure
              ? undefined
              : "Listo para leer — pulse el botón verde de abajo")
          }
          readingViews={
            vitalsDraft.systolicPressure && vitalsDraft.diastolicPressure
              ? [
                  interpretBloodPressure(
                    vitalsDraft.systolicPressure,
                    vitalsDraft.diastolicPressure,
                  )!,
                  ...(interpretHeartRate(vitalsDraft.heartRate)
                    ? [interpretHeartRate(vitalsDraft.heartRate)!]
                    : []),
                ]
              : undefined
          }
          onCapture={() => void captureBp()}
          captureLabel="Leer presión ahora"
          capturingLabel="Ya vi el resultado"
          captureHelp="El cable se queda puesto. Coloque el brazalete, pulse inicio en el aparato y, al ver el número, toque Ya vi el resultado."
          tips={["No desconecte el USB. Si el aparato no enciende, avise al personal: falta un permiso de Windows en esta PC."]}
          capturing={bpCapturing}
          captureCanConfirm
          onSimulate={() => simulateReading({ systolicPressure: "118", diastolicPressure: "76", heartRate: "72" })}
          onContinue={async () => {
            if (!vitalsDraft.systolicPressure) {
              failWithVoice("Primero toque el botón verde «Leer presión ahora».");
              return;
            }
            setError(null);
            setDeviceStatus("idle");
            await goToStep("oxygen");
          }}
          onBack={goBack}
          onRetry={() => {
            void clearVitalFields(VITAL_FIELDS.blood_pressure);
            setBpStatus("Pulsa Leer presión ahora");
            setDeviceStatus("idle");
          }}
        />
      )}

      {step === "oxygen" && (
        <VitalStepScreen
          compact
          stepNumber={3}
          totalSteps={5}
          title="Oxigenación y pulso"
          instruction=""
          steps={[...OXYGEN_VOICE_STEPS]}
          tips={[OXYGEN_NAIL_TIP]}
          illustration="oxygen"
          deviceStatus={resolveVitalUiStatus(deviceStatus, Boolean(vitalsDraft.oxygenSaturation))}
          statusMessage={
            oxygenStatus ||
            (vitalsDraft.oxygenSaturation
              ? undefined
              : "Listo para leer — pulse el botón verde de abajo")
          }
          referenceRanges={[VITAL_RANGE_COPY.spo2, VITAL_RANGE_COPY.heartRate]}
          readingViews={
            vitalsDraft.oxygenSaturation
              ? [
                  interpretSpo2(vitalsDraft.oxygenSaturation)!,
                  ...(interpretHeartRate(vitalsDraft.heartRate)
                    ? [interpretHeartRate(vitalsDraft.heartRate)!]
                    : []),
                ]
              : undefined
          }
          onCapture={() => void captureOximeter()}
          captureLabel="Leer oxímetro ahora"
          capturingLabel="Esperando lectura estable…"
          captureHelp="No se guarda hasta que SpO₂ y pulso estén estables. Si Edge pide red local, elija Permitir."
          capturing={oxygenCapturing}
          onSimulate={() =>
            simulateReading({
              oxygenSaturation: "98",
              heartRate: vitalsDraft.heartRate ?? "72",
            })
          }
          onContinue={async () => {
            if (!vitalsDraft.oxygenSaturation) {
              failWithVoice("Primero toque el botón verde «Leer oxímetro ahora».");
              return;
            }
            setError(null);
            setOxygenStatus("");
            setDeviceStatus("idle");
            await goToStep("temperature");
          }}
          onBack={goBack}
          onRetry={async () => {
            await clearVitalFields(["oxygenSaturation", "heartRate"]);
            setOxygenStatus("Pulsa Leer oxímetro ahora");
            setDeviceStatus("idle");
          }}
        />
      )}

      {step === "temperature" && (
        <VitalStepScreen
          compact
          stepNumber={4}
          totalSteps={5}
          title="Temperatura"
          instruction=""
          steps={[...TEMPERATURE_VOICE_STEPS]}
          tips={["El termómetro va en la axila, no en la frente."]}
          illustration="temperature"
          deviceStatus={resolveVitalUiStatus(deviceStatus, Boolean(vitalsDraft.temperature))}
          referenceRanges={[VITAL_RANGE_COPY.temperature]}
          readingViews={
            vitalsDraft.temperature
              ? [interpretTemperature(vitalsDraft.temperature)!]
              : undefined
          }
          onSimulate={() => simulateReading({ temperature: "36.7" })}
          onContinue={async () => {
            if (!vitalsDraft.temperature) {
              failWithVoice(
                "Todavía no llega la lectura de temperatura. Mantenga el termómetro en la axila un momento.",
              );
              return;
            }
            setError(null);
            setDeviceStatus("idle");
            await goToStep("ecg");
          }}
          onBack={goBack}
          onRetry={() => clearVitalFields(VITAL_FIELDS.temperature)}
        />
      )}

      {step === "ecg" && (
        <VitalStepScreen
          compact
          stepNumber={5}
          totalSteps={5}
          title="Electrocardiograma"
          instruction=""
          steps={[...ECG_VOICE_STEPS]}
          tips={["Es un ECG de un solo canal: ponga los dedos en las placas metálicas, no en el pecho."]}
          illustration="ecg"
          deviceStatus={resolveVitalUiStatus(deviceStatus, Boolean(vitalsDraft.ecgStatus))}
          referenceRanges={[VITAL_RANGE_COPY.ecg, VITAL_RANGE_COPY.heartRate]}
          readingViews={
            vitalsDraft.ecgStatus
              ? [
                  interpretEcg(vitalsDraft.ecgStatus, vitalsDraft.ecgRhythm)!,
                  ...(interpretHeartRate(vitalsDraft.ecgHeartRate ?? vitalsDraft.heartRate)
                    ? [interpretHeartRate(vitalsDraft.ecgHeartRate ?? vitalsDraft.heartRate)!]
                    : []),
                ]
              : undefined
          }
          statusMessage={
            ecgStatusMsg ||
            (vitalsDraft.ecgStatus === "done"
              ? undefined
              : vitalsDraft.ecgStatus === "skipped"
                ? "ECG omitido"
                : "Cuando esté listo, toque Leer electrocardiograma")
          }
          onCapture={() => void captureEcg()}
          captureLabel="Leer electrocardiograma"
          capturingLabel="Ya terminó"
          captureHelp="El cable se queda puesto. Toque Leer, ponga los dedos 30 s, acepte guardar si lo pide, y toque Ya terminó."
          captureOptional
          capturing={ecgCapturing}
          captureCanConfirm
          onSimulate={() =>
            simulateReading({
              ecgStatus: "done",
              ecgRhythm: "Ritmo sinusal normal",
              ecgHeartRate: "72",
              heartRate: vitalsDraft.heartRate ?? "72",
            })
          }
          onContinue={async () => {
            if (!vitalsDraft.ecgStatus) {
              await simulateReading({ ecgStatus: "skipped" });
            }
            setError(null);
            setEcgStatusMsg("");
            setDeviceStatus("idle");
            await goToStep("summary");
          }}
          onBack={goBack}
          onRetry={async () => {
            await clearVitalFields(["ecgStatus", "ecgRhythm", "ecgHeartRate"]);
            setEcgStatusMsg("Pulsa Leer electrocardiograma");
            setDeviceStatus("idle");
          }}
        />
      )}

      {step === "summary" && (
        <KioskCard className="flex min-h-0 flex-1 flex-col">
          <h2 className={`shrink-0 ${kioskTitleClassName}`}>Sus signos vitales</h2>
          <p className={`shrink-0 ${kioskSubtitleClassName}`}>
            Cada valor muestra el rango normal y si está dentro o fuera. Estos datos quedarán en su
            receta; el médico interpreta su caso completo.
          </p>
          <div className="mt-3 min-h-0 flex-1">
            <VitalsSummaryGrid draft={vitalsDraft} />
          </div>
          {error ? (
            <div className="mt-3 shrink-0">
              <KioskError message={error} />
            </div>
          ) : null}
          <div className="mt-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <KioskSecondaryButton
              type="button"
              disabled={busy}
              onClick={() => void beginCorrectionFromSummary("registration")}
            >
              Corregir datos personales
            </KioskSecondaryButton>
            <KioskSecondaryButton
              type="button"
              disabled={busy}
              onClick={() => void beginCorrectionFromSummary("symptoms")}
            >
              Corregir síntomas
            </KioskSecondaryButton>
          </div>
          <div className="mt-3 flex w-full shrink-0 flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap">
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
            <KioskPrimaryButton className="w-full flex-1" disabled={busy} onClick={() => void runAnalysis()}>
              {busy ? "El equipo médico está revisando…" : "Revisar mi atención con el equipo médico"}
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {step === "analysis" && (
        <KioskCard className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f7ff] text-3xl">
            🩺
          </div>
          <h2 className={`mt-6 ${kioskTitleClassName}`}>
            Estamos revisando su caso
          </h2>
          <p className={`mt-4 w-full ${kioskBodyClassName}`}>
            El equipo médico de la estación está leyendo sus síntomas y sus signos vitales para
            decidir el mejor tratamiento para usted. Quédese aquí, no tardamos.
          </p>
          <p className={`mt-6 animate-pulse font-medium text-[#1d6eb8] ${kioskBodyClassName}`}>
            Un momento, por favor…
          </p>
        </KioskCard>
      )}

      {step === "result" && assessment && assessment.prescriptionId && (
        <KioskCard className="flex h-full min-h-0 flex-col">
          <div className="shrink-0">
            <h2 className={kioskTitleClassName}>Su receta</h2>
            <p className={kioskSubtitleClassName}>
              Se enviará a su correo. Indique si también desea una copia impresa.
            </p>
          </div>
          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            <DownloadPrescriptionButton
              prescriptionId={assessment.prescriptionId}
              folio={assessment.prescriptionFolio}
              email={patient?.email || receiptEmail || null}
              onDone={resetKiosk}
            />
          </div>
        </KioskCard>
      )}

      {step === "result" && assessment && !assessment.prescriptionId && (
        <KioskCard>
          <KioskScrollArea>
          <p className="text-base font-semibold uppercase tracking-wide text-emerald-600 sm:text-lg">
            Evaluación preliminar completada
          </p>
          <h2 className={`mt-2 ${kioskTitleClassName}`}>{assessment.diagnosis}</h2>
          <p className={`mt-4 ${kioskBodyClassName}`}>{assessment.summary}</p>
          {assessment.protocolName && (
            <p className={`mt-3 ${kioskHelperClassName}`}>
              Protocolo: <strong>{assessment.protocolCode}</strong> — {assessment.protocolName}
            </p>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <h3 className="text-lg font-semibold text-slate-800 sm:text-xl">Plan de tratamiento</h3>
              <p className={`mt-2 ${kioskBodyClassName}`}>
                {displayTreatmentPlan(assessment.treatmentPlan, assessment.medications)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <h3 className="text-lg font-semibold text-slate-800 sm:text-xl">Indicaciones</h3>
              <p className={`mt-2 ${kioskBodyClassName}`}>
                {normalizeAssessmentText(
                  assessment.instructions,
                  "Sigue las indicaciones del protocolo y regresa si aparecen signos de alarma.",
                )}
              </p>
            </div>
          </div>
          </KioskScrollArea>
          <div className="mt-3 flex w-full shrink-0 justify-center border-t border-slate-100 pt-3">
            <KioskPrimaryButton className="w-full" onClick={resetKiosk}>
              Finalizar
            </KioskPrimaryButton>
          </div>
        </KioskCard>
      )}

      {(step === "waiting" || step === "consultation") && appointmentId ? (
        <StationAutoPrintWatcher appointmentId={appointmentId} mode="kiosk" />
      ) : null}

      {(step === "waiting" || step === "consultation") && (
        <KioskCard className="text-center">
          <KioskScrollArea>
          <WaitingIllustration />
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 xl:text-5xl">
            {callEnded
              ? "Consulta finalizada"
              : doctorJoined
                ? "El médico ya se está conectando"
                : "Teleconsulta en camino"}
          </h2>
          <p className="mt-5 w-full text-2xl leading-snug text-slate-700 xl:text-3xl">
            {callEnded
              ? "Gracias. En unos segundos la estación vuelve al inicio para el siguiente paciente."
              : (
                <>
                  Por favor, <strong>mire la pantalla principal frente a usted</strong> (donde está la
                  cámara). Escuchará al doctor por la bocina y hable hacia el micrófono de la estación.
                </>
              )}
          </p>
          {!callEnded ? (
          <KioskInfo className="mt-6 w-full px-5 py-5 text-left text-2xl leading-snug xl:text-3xl">
            <p className="text-2xl font-bold text-[#0f3d66] xl:text-3xl">En la pantalla de enfrente:</p>
            <ol className="mt-4 list-decimal space-y-3 pl-8 text-2xl leading-snug text-slate-800 xl:text-3xl">
              <li>Mire de frente a esa pantalla (cámara)</li>
              <li>Escuche por la bocina de la estación</li>
              <li>Hable con claridad hacia el micrófono fijo</li>
            </ol>
          </KioskInfo>
          ) : null}
          {!callEnded && assessment?.redFlags && assessment.redFlags.length > 0 && (
            <ul className="mt-5 w-full space-y-3 text-left">
              {assessment.redFlags.map((flag) => (
                <li key={flag}>
                  <KioskImportant className="text-2xl xl:text-3xl">{flag}</KioskImportant>
                </li>
              ))}
            </ul>
          )}
          {!callEnded ? (
          <p className="mt-6 animate-pulse text-2xl font-bold text-[#1d6eb8] xl:text-3xl">
            {doctorJoined
              ? "Video activo — hable con el doctor en la pantalla principal"
              : "Avisando al médico… mire la pantalla principal"}
          </p>
          ) : null}
          </KioskScrollArea>
          {!callEnded && !doctorJoined && (
            <div className="mt-5">
              <KioskSecondaryButton
                className="w-full"
                onClick={() => {
                  doctorJoinedRef.current = true;
                  calmSilencedRef.current = true;
                  stopKioskVoice();
                  setCrisisMode(false);
                  setDoctorJoined(true);
                }}
              >
                El médico ya me está atendiendo (silenciar guía)
              </KioskSecondaryButton>
            </div>
          )}
          {!callEnded && assessment?.roomError ? (
            <div className="mt-5 w-full rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-left text-2xl font-semibold leading-snug text-red-900 xl:text-3xl">
              <p>No se pudo preparar el video automáticamente</p>
              <p className="mt-2 text-xl font-medium text-red-900 xl:text-2xl">
                Avise al personal de la estación. El médico ya puede estar siendo contactado.
              </p>
            </div>
          ) : null}
          {error && step === "waiting" && (
            <div className="mt-5 w-full">
              <KioskError message={error} />
            </div>
          )}
          {!callEnded ? (
          <div className="mt-6 flex w-full flex-col items-stretch gap-3 border-t border-slate-100 pt-5">
            <KioskPrimaryButton className="w-full" onClick={resetKiosk}>
              Finalizar y salir
            </KioskPrimaryButton>
          </div>
          ) : null}
        </KioskCard>
      )}
    </KioskShell>
  );
}

/** Ayuda urgente: visible desde la bienvenida, antes de cualquier paso. */
function CrisisButton({
  onClick,
  disabled,
  tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: "urgent" | "soft";
}) {
  const className =
    tone === "urgent"
      ? "w-full min-h-[72px] rounded-2xl border-2 border-red-400 bg-red-600 px-5 py-3 text-2xl font-bold leading-tight text-white shadow-md transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-60 xl:min-h-[80px] xl:text-3xl"
      : "w-full min-h-[68px] rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-3 text-xl font-bold leading-tight text-red-800 transition hover:bg-red-100 active:scale-[0.99] disabled:opacity-60 xl:min-h-[76px] xl:text-2xl";
  return (
    <div>
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        Necesito ayuda urgente ahora
      </button>
      <p className={`mt-2 text-center ${kioskHelperClassName}`}>
        Le conectamos de inmediato con un médico. No necesita llenar nada.
      </p>
    </div>
  );
}

/** Pie fijo compartido por síntomas / antecedentes / consentimiento.
 * Se oculta con CSS global `.kiosk-kb-open` mientras el teclado está abierto.
 */
function ClinicalStepFooter({
  message,
  busy,
  onBack,
  onContinue,
  continueLabel = "Continuar",
}: {
  message: string | null;
  busy: boolean;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
}) {
  return (
    <div
      data-kiosk-clinical-footer
      className="sticky bottom-[var(--kiosk-keyboard-height,0px)] z-10 -mx-4 mt-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5"
    >
      {message && (
        <div className="mb-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-base font-semibold leading-snug text-red-900 sm:text-lg">
          <p>Aún no podemos continuar</p>
          <p className="mt-1 text-sm font-medium leading-relaxed sm:text-base">{message}</p>
        </div>
      )}
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <KioskSecondaryButton onClick={onBack} disabled={busy}>
          ← Atrás
        </KioskSecondaryButton>
        <KioskPrimaryButton className="w-full flex-1" disabled={busy} onClick={onContinue}>
          {continueLabel}
        </KioskPrimaryButton>
      </div>
    </div>
  );
}

function BigChoice({
  title,
  subtitle,
  icon,
  onClick,
  compact = false,
  highlight = false,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onClick: () => void;
  /** Filas densas: caben 3 opciones en Identificación con scroll si hace falta. */
  compact?: boolean;
  highlight?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group flex min-h-[88px] w-full flex-1 items-center gap-4 rounded-2xl border-2 px-5 py-3.5 text-left shadow-sm transition active:scale-[0.99] xl:min-h-[96px] ${
          highlight
            ? "border-[#1d6eb8] bg-[#eef5fc] hover:bg-[#e5f1fc]"
            : "border-slate-200 bg-gradient-to-b from-white to-slate-50/80 hover:border-[#1d6eb8]/40 hover:shadow-md"
        }`}
      >
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl ${
            highlight ? "bg-white" : "bg-[#f0f7ff] group-hover:bg-[#1d6eb8]/10"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-bold leading-tight text-slate-900 xl:text-3xl">
            {title}
          </span>
          <span className="mt-1 block text-lg leading-snug text-slate-600 xl:text-xl">
            {subtitle}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-2xl text-[#1d6eb8] xl:text-3xl">
          →
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[88px] w-full items-center gap-4 rounded-xl border-2 border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-5 py-4 text-left shadow-sm transition hover:border-[#1d6eb8]/40 hover:shadow-md active:scale-[0.99] xl:min-h-[96px]"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f0f7ff] text-3xl transition group-hover:bg-[#1d6eb8]/10">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold leading-tight text-slate-900 xl:text-3xl">
          {title}
        </span>
        <span className={`mt-0.5 block ${kioskHelperClassName}`}>{subtitle}</span>
      </span>
      <span aria-hidden className="shrink-0 text-2xl text-[#1d6eb8]">
        →
      </span>
    </button>
  );
}

function ConfirmDataPanel({
  patient,
  confirmed,
  onConfirm,
  onContinue,
  onCreateProfile,
  profileDraft,
  onProfileDraftChange,
  emailValue,
  onEmailChange,
  continueLabel = "Continuar",
}: {
  patient: PatientPayload;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  onContinue: () => void;
  onCreateProfile?: (username: string, password: string) => Promise<void>;
  profileDraft: ProfileDraft;
  onProfileDraftChange: (next: ProfileDraft) => void;
  emailValue: string;
  onEmailChange: (value: string) => void;
  continueLabel?: string;
}) {
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(!patient.hasKioskLogin);
  const canManageProfile = Boolean(onCreateProfile);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim());

  return (
    <div className="mt-6 rounded-2xl border border-[#1d6eb8]/20 bg-[#f0f7ff]/50 p-4 sm:p-5">
      <p className={`font-semibold text-slate-900 ${kioskTitleClassName}`}>{patient.name}</p>
      <p className={kioskHelperClassName}>Expediente {patient.chartNumber}</p>
      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <input
          type="checkbox"
          className="h-7 w-7 rounded text-[#1d6eb8]"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
        />
        <span className={`font-medium text-slate-700 ${kioskBodyClassName}`}>
          Confirmo que mis datos son correctos
        </span>
      </label>

      <div className="mt-4">
        <label className={kioskLabelClassName}>Correo electrónico * (para su receta)</label>
        <input
          {...kioskTextFieldProps}
          name="confirmEmail"
          type="text"
          autoComplete="email"
          value={emailValue}
          onChange={(e) => onEmailChange(e.target.value)}
          className={kioskInputClassName}
          placeholder="ej. juan.perez@gmail.com"
          required
        />
        {!emailOk ? (
          <p className={`mt-1 text-rose-700 ${kioskHelperClassName}`}>
            Obligatorio. Ahí le enviaremos la receta.
          </p>
        ) : null}
      </div>

      {canManageProfile && patient.hasKioskLogin && !showResetForm ? (
        <div className="mt-4 space-y-3">
          <p className={`text-emerald-800 ${kioskHelperClassName}`}>
            Ya tiene usuario de estación. Si lo recuerda, puede continuar. Si lo olvidó, cree uno
            nuevo abajo.
          </p>
          <KioskSecondaryButton
            type="button"
            className="w-full"
            onClick={() => {
              setShowResetForm(true);
              setProfileMsg(null);
              setProfileError(null);
            }}
          >
            Olvidé mi clave — crear usuario y contraseña nuevos
          </KioskSecondaryButton>
        </div>
      ) : null}

      {canManageProfile && showResetForm ? (
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const username = profileDraft.username.trim();
            const password = profileDraft.password;
            setProfileError(null);
            setProfileBusy(true);
            void onCreateProfile?.(username, password)
              .then(() => {
                setProfileMsg(
                  patient.hasKioskLogin
                    ? "Listo. Usuario y contraseña actualizados para la próxima visita."
                    : "Perfil guardado. La próxima vez puede entrar con usuario y contraseña.",
                );
                setShowResetForm(false);
              })
              .catch((err) => {
                setProfileError(err instanceof Error ? err.message : "No se pudo guardar el perfil");
              })
              .finally(() => setProfileBusy(false));
          }}
        >
          <p className={`sm:col-span-2 font-medium text-slate-800 ${kioskBodyClassName}`}>
            {patient.hasKioskLogin
              ? "Escriba un usuario y una contraseña nuevos (reemplazan los anteriores)"
              : "Cree aquí su usuario y contraseña para la próxima visita (recomendado)"}
          </p>
          <input
            name="username"
            placeholder="Usuario"
            value={profileDraft.username}
            onChange={(e) => onProfileDraftChange({ ...profileDraft, username: e.target.value })}
            {...kioskTextFieldProps}
            className={kioskInputClassName}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña (mín. 4)"
            value={profileDraft.password}
            onChange={(e) => onProfileDraftChange({ ...profileDraft, password: e.target.value })}
            {...kioskTextFieldProps}
            className={kioskInputClassName}
            required
            minLength={4}
          />
          <div className="sm:col-span-2">
            <KioskSecondaryButton className="w-full" type="submit" disabled={profileBusy || !confirmed}>
              {profileBusy
                ? "Guardando…"
                : patient.hasKioskLogin
                  ? "Guardar nueva clave"
                  : "Guardar usuario y contraseña"}
            </KioskSecondaryButton>
          </div>
          {profileMsg ? (
            <p className={`sm:col-span-2 text-emerald-700 ${kioskHelperClassName}`}>{profileMsg}</p>
          ) : null}
          {profileError ? (
            <p className={`sm:col-span-2 text-rose-700 ${kioskHelperClassName}`}>{profileError}</p>
          ) : null}
        </form>
      ) : null}

      {profileMsg && !showResetForm ? (
        <p className={`mt-4 text-emerald-700 ${kioskHelperClassName}`}>{profileMsg}</p>
      ) : null}

      <div className="mt-5">
        <KioskPrimaryButton
          className="w-full"
          disabled={!confirmed || !emailOk}
          onClick={onContinue}
        >
          {continueLabel}
        </KioskPrimaryButton>
      </div>
    </div>
  );
}

function YesNo({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
      <span className="text-xl font-semibold leading-snug text-slate-900 xl:text-2xl">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-h-[56px] min-w-[96px] rounded-xl px-5 py-2.5 text-xl font-bold transition xl:min-h-[64px] xl:text-2xl ${
            !checked ? "bg-[#1d6eb8] text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-h-[56px] min-w-[96px] rounded-xl px-5 py-2.5 text-xl font-bold transition xl:min-h-[64px] xl:text-2xl ${
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
  helper,
  value,
  onValueChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  helper?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const usesVirtualKeyboard = !["date", "datetime-local", "month", "week", "time"].includes(type);
  const controlled = value !== undefined && onValueChange !== undefined;
  return (
    <div>
      <label className={kioskLabelClassName}>{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        {...(controlled ? { value, onChange: (e) => onValueChange(e.target.value) } : {})}
        {...(usesVirtualKeyboard ? kioskTextFieldProps : {})}
        className={kioskInputClassName}
      />
      {helper ? <p className={`mt-1 ${kioskHelperClassName}`}>{helper}</p> : null}
    </div>
  );
}
