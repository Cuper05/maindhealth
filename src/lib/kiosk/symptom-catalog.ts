/**
 * Catálogo guiado de síntomas para el kiosco.
 * Intensidad y duración se capturan por cada síntoma / zona de dolor.
 */

export type SymptomPrimaryCode =
  | "dolor"
  | "fiebre"
  | "tos"
  | "dificultad_respiratoria"
  | "mareo"
  | "nausea"
  | "diarrea"
  | "fatiga"
  | "dolor_cabeza"
  | "palpitaciones"
  | "sintomas_urinarios"
  | "otro";

export type PainLocationCode =
  | "cabeza"
  | "cuello"
  | "pecho"
  | "abdomen"
  | "espalda"
  | "brazos"
  | "piernas"
  | "articulaciones"
  | "generalizado";

export type SymptomIntensity = "leve" | "moderada" | "intensa";
export type SymptomDuration = "horas" | "1_2_dias" | "3_7_dias" | "mas_1_semana";

export type SymptomDetail = {
  intensity?: SymptomIntensity;
  duration?: SymptomDuration;
};

export type SymptomSelection = {
  primary: SymptomPrimaryCode[];
  painLocations: PainLocationCode[];
  /** Detalle por síntoma primario (excepto "dolor", que usa painDetails). */
  symptomDetails: Partial<Record<SymptomPrimaryCode, SymptomDetail>>;
  /** Detalle por zona de dolor. */
  painDetails: Partial<Record<PainLocationCode, SymptomDetail>>;
  otherText?: string;
};

export const SYMPTOM_PRIMARY_OPTIONS: Array<{
  code: SymptomPrimaryCode;
  label: string;
  redFlag?: boolean;
  complaintPhrase?: string;
}> = [
  { code: "dolor", label: "Dolor" },
  { code: "dolor_cabeza", label: "Dolor de cabeza", complaintPhrase: "dolor de cabeza" },
  { code: "fiebre", label: "Fiebre", complaintPhrase: "fiebre" },
  { code: "tos", label: "Tos / resfriado", complaintPhrase: "tos y resfriado" },
  {
    code: "dificultad_respiratoria",
    label: "Falta de aire",
    redFlag: true,
    complaintPhrase: "falta de aire",
  },
  { code: "mareo", label: "Mareo", complaintPhrase: "mareo" },
  { code: "nausea", label: "Náusea / vómito", complaintPhrase: "náuseas" },
  { code: "diarrea", label: "Diarrea", complaintPhrase: "diarrea" },
  { code: "fatiga", label: "Fatiga / cansancio", complaintPhrase: "fatiga" },
  { code: "palpitaciones", label: "Palpitaciones", complaintPhrase: "palpitaciones" },
  { code: "sintomas_urinarios", label: "Molestia urinaria", complaintPhrase: "síntomas urinarios" },
  { code: "otro", label: "Otro" },
];

export const PAIN_LOCATION_OPTIONS: Array<{
  code: PainLocationCode;
  label: string;
  redFlag?: boolean;
  complaintPhrase: string;
}> = [
  { code: "cabeza", label: "Cabeza", complaintPhrase: "dolor de cabeza" },
  { code: "cuello", label: "Cuello", complaintPhrase: "dolor de cuello" },
  { code: "pecho", label: "Pecho", redFlag: true, complaintPhrase: "dolor de pecho" },
  { code: "abdomen", label: "Estómago / abdomen", complaintPhrase: "dolor estomacal" },
  { code: "espalda", label: "Espalda", complaintPhrase: "dolor de espalda" },
  { code: "brazos", label: "Brazos", complaintPhrase: "dolor en brazos" },
  { code: "piernas", label: "Piernas", complaintPhrase: "dolor en piernas" },
  { code: "articulaciones", label: "Articulaciones", complaintPhrase: "dolor articular" },
  { code: "generalizado", label: "Todo el cuerpo", complaintPhrase: "dolor generalizado" },
];

export const INTENSITY_OPTIONS: Array<{ code: SymptomIntensity; label: string }> = [
  { code: "leve", label: "Leve" },
  { code: "moderada", label: "Moderada" },
  { code: "intensa", label: "Intensa" },
];

export const DURATION_OPTIONS: Array<{ code: SymptomDuration; label: string }> = [
  { code: "horas", label: "Horas" },
  { code: "1_2_dias", label: "1–2 días" },
  { code: "3_7_dias", label: "3–7 días" },
  { code: "mas_1_semana", label: "Más de 1 semana" },
];

export const emptySymptomSelection = (): SymptomSelection => ({
  primary: [],
  painLocations: [],
  symptomDetails: {},
  painDetails: {},
  otherText: "",
});

export function needsPainLocation(selection: SymptomSelection) {
  return selection.primary.includes("dolor");
}

function detailPhrase(detail?: SymptomDetail) {
  const bits: string[] = [];
  if (detail?.intensity) {
    const label = INTENSITY_OPTIONS.find((o) => o.code === detail.intensity)?.label;
    if (label) bits.push(`intensidad ${label.toLowerCase()}`);
  }
  if (detail?.duration) {
    const label = DURATION_OPTIONS.find((o) => o.code === detail.duration)?.label;
    if (label) bits.push(`desde ${label.toLowerCase()}`);
  }
  return bits.join(", ");
}

function isDetailComplete(detail?: SymptomDetail) {
  return Boolean(detail?.intensity && detail?.duration);
}

export function detectSymptomRedFlags(selection: SymptomSelection): string[] {
  const flags: string[] = [];
  if (selection.primary.includes("dificultad_respiratoria")) {
    flags.push("Falta de aire reportada por el paciente");
  }
  if (selection.painLocations.includes("pecho")) {
    flags.push("Dolor de pecho seleccionado");
    if (selection.painDetails.pecho?.intensity === "intensa") {
      flags.push("Dolor torácico intenso");
    }
  }
  return flags;
}

/** Construye el motivo de consulta en texto para intake + match de protocolos. */
export function buildChiefComplaintFromSelection(selection: SymptomSelection): string {
  const parts: string[] = [];

  if (selection.primary.includes("dolor")) {
    if (selection.painLocations.length > 0) {
      for (const loc of selection.painLocations) {
        const opt = PAIN_LOCATION_OPTIONS.find((o) => o.code === loc);
        if (!opt) continue;
        const extra = detailPhrase(selection.painDetails[loc]);
        parts.push(extra ? `${opt.complaintPhrase} (${extra})` : opt.complaintPhrase);
      }
    } else {
      parts.push("dolor");
    }
  }

  for (const code of selection.primary) {
    if (code === "dolor" || code === "otro") continue;
    const opt = SYMPTOM_PRIMARY_OPTIONS.find((o) => o.code === code);
    if (!opt?.complaintPhrase) continue;
    const extra = detailPhrase(selection.symptomDetails[code]);
    parts.push(extra ? `${opt.complaintPhrase} (${extra})` : opt.complaintPhrase);
  }

  if (selection.primary.includes("otro")) {
    const other = selection.otherText?.trim();
    if (other) {
      const extra = detailPhrase(selection.symptomDetails.otro);
      parts.push(extra ? `${other} (${extra})` : other);
    }
  }

  return parts.filter(Boolean).join("; ");
}

function symptomLabel(code: SymptomPrimaryCode): string {
  return SYMPTOM_PRIMARY_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

function painLabel(code: PainLocationCode): string {
  return PAIN_LOCATION_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

function detailGapMessage(label: string, detail?: SymptomDetail): string | null {
  const missingIntensity = !detail?.intensity;
  const missingDuration = !detail?.duration;
  if (!missingIntensity && !missingDuration) return null;
  if (missingIntensity && missingDuration) {
    return `${label}: falta Intensidad y Desde cuándo`;
  }
  if (missingIntensity) return `${label}: falta Intensidad`;
  return `${label}: falta Desde cuándo`;
}

/** Mensajes concretos de lo que falta para poder Continuar. */
export function getSymptomSelectionGaps(selection: SymptomSelection): string[] {
  const gaps: string[] = [];

  if (selection.primary.length === 0) {
    gaps.push("Selecciona al menos un síntoma en «¿Qué sientes hoy?»");
    return gaps;
  }

  if (selection.primary.includes("dolor") && selection.painLocations.length === 0) {
    gaps.push("Indicaste Dolor: elige dónde duele");
  }

  if (selection.primary.includes("dolor")) {
    for (const loc of selection.painLocations) {
      const msg = detailGapMessage(`Dolor · ${painLabel(loc)}`, selection.painDetails[loc]);
      if (msg) gaps.push(msg);
    }
  }

  for (const code of selection.primary) {
    if (code === "dolor") continue;
    if (code === "otro") {
      if ((selection.otherText?.trim().length ?? 0) < 3) {
        gaps.push("Describe el otro síntoma (mínimo 3 caracteres)");
      }
      const msg = detailGapMessage(symptomLabel("otro"), selection.symptomDetails.otro);
      if (msg) gaps.push(msg);
      continue;
    }
    const msg = detailGapMessage(symptomLabel(code), selection.symptomDetails[code]);
    if (msg) gaps.push(msg);
  }

  if (gaps.length === 0 && buildChiefComplaintFromSelection(selection).trim().length < 3) {
    gaps.push("Completa la selección de síntomas");
  }

  return gaps;
}

export function isSymptomSelectionComplete(selection: SymptomSelection): boolean {
  return getSymptomSelectionGaps(selection).length === 0;
}

/** Claves de detalle incompleto (para resaltar en la UI). */
export function getIncompleteSymptomDetailKeys(selection: SymptomSelection): Set<string> {
  const keys = new Set<string>();
  if (selection.primary.includes("dolor")) {
    for (const loc of selection.painLocations) {
      if (!isDetailComplete(selection.painDetails[loc])) keys.add(`pain-${loc}`);
    }
  }
  for (const code of selection.primary) {
    if (code === "dolor") continue;
    if (code === "otro") {
      if (!isDetailComplete(selection.symptomDetails.otro)) keys.add("symptom-otro");
      continue;
    }
    if (!isDetailComplete(selection.symptomDetails[code])) keys.add(`symptom-${code}`);
  }
  return keys;
}

export function symptomSelectionFromUnknown(value: unknown): SymptomSelection {
  const base = emptySymptomSelection();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  const primary = Array.isArray(v.primary) ? (v.primary as SymptomPrimaryCode[]) : [];
  const painLocations = Array.isArray(v.painLocations) ? (v.painLocations as PainLocationCode[]) : [];

  const symptomDetails =
    v.symptomDetails && typeof v.symptomDetails === "object"
      ? (v.symptomDetails as SymptomSelection["symptomDetails"])
      : {};
  const painDetails =
    v.painDetails && typeof v.painDetails === "object"
      ? (v.painDetails as SymptomSelection["painDetails"])
      : {};

  // Compatibilidad con versión anterior (intensidad/duración globales)
  if (typeof v.intensity === "string" || typeof v.duration === "string") {
    const legacy: SymptomDetail = {
      intensity: typeof v.intensity === "string" ? (v.intensity as SymptomIntensity) : undefined,
      duration: typeof v.duration === "string" ? (v.duration as SymptomDuration) : undefined,
    };
    for (const code of primary) {
      if (code === "dolor") continue;
      if (!symptomDetails[code]) symptomDetails[code] = legacy;
    }
    for (const loc of painLocations) {
      if (!painDetails[loc]) painDetails[loc] = legacy;
    }
  }

  return {
    primary,
    painLocations,
    symptomDetails,
    painDetails,
    otherText: typeof v.otherText === "string" ? v.otherText : "",
  };
}
