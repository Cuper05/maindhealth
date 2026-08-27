/**
 * Catálogo guiado de síntomas para el kiosco.
 * Intensidad y duración se capturan por cada síntoma / zona de dolor.
 */

export type SymptomPrimaryCode =
  | "dolor"
  | "ardor"
  | "fiebre"
  | "tos"
  | "dolor_garganta"
  | "congestion"
  | "dificultad_respiratoria"
  | "dolor_muscular"
  | "mareo"
  | "desmayo"
  | "debilidad"
  | "entumecimiento"
  | "confusion"
  | "dificultad_hablar"
  | "nausea"
  | "diarrea"
  | "estrenimiento"
  | "fatiga"
  | "dolor_cabeza"
  | "palpitaciones"
  | "sintomas_urinarios"
  | "oido"
  | "ojo_rojo"
  | "erupcion_piel"
  | "reaccion_alergica"
  | "hinchazon"
  | "ansiedad"
  | "otro";

export type PainLocationCode =
  | "cabeza"
  | "nuca"
  | "cuello"
  | "cuello_esp"
  | "pecho"
  | "abdomen_epigastrio"
  | "abdomen_umbilical"
  | "abdomen_bajo"
  | "abdomen_flanco_dcho"
  | "abdomen_flanco_izq"
  /** Compat sesiones viejas */
  | "abdomen"
  | "espalda_alta"
  | "espalda_media"
  | "espalda_lumbar"
  | "espalda"
  | "omoplato_izq"
  | "omoplato_der"
  | "dorsal_izq"
  | "dorsal_der"
  | "lumbar_izq"
  | "lumbar_der"
  | "hombro_izq"
  | "hombro_der"
  | "hombro_izq_esp"
  | "hombro_der_esp"
  | "hombros"
  | "brazo_superior_izq"
  | "brazo_superior_der"
  | "brazo_superior_izq_esp"
  | "brazo_superior_der_esp"
  | "brazo_superior"
  | "codo_izq"
  | "codo_der"
  | "codo_izq_esp"
  | "codo_der_esp"
  | "codos"
  | "antebrazo_izq"
  | "antebrazo_der"
  | "antebrazo_izq_esp"
  | "antebrazo_der_esp"
  | "antebrazos"
  | "mano_izq"
  | "mano_der"
  | "mano_izq_esp"
  | "mano_der_esp"
  | "manos"
  | "gluteo_izq"
  | "gluteo_der"
  | "gluteos"
  | "muslo_izq"
  | "muslo_der"
  | "muslo_izq_esp"
  | "muslo_der_esp"
  | "muslos"
  | "rodilla_izq"
  | "rodilla_der"
  | "rodilla_izq_esp"
  | "rodilla_der_esp"
  | "rodillas"
  | "espinilla_izq"
  | "espinilla_der"
  | "pantorrilla_izq"
  | "pantorrilla_der"
  | "pantorrilla_izq_esp"
  | "pantorrilla_der_esp"
  | "pantorrillas"
  | "tobillo_izq"
  | "tobillo_der"
  | "tobillo_izq_esp"
  | "tobillo_der_esp"
  | "pie_izq"
  | "pie_der"
  | "pie_izq_esp"
  | "pie_der_esp"
  | "pies"
  /** Compat: zonas generales de extremidades */
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
  { code: "ardor", label: "Ardor", complaintPhrase: "ardor" },
  { code: "dolor_cabeza", label: "Dolor de cabeza", complaintPhrase: "dolor de cabeza" },
  { code: "dolor_muscular", label: "Dolor muscular / cuerpo cortado", complaintPhrase: "dolor muscular cuerpo cortado" },
  { code: "dolor_garganta", label: "Dolor de garganta", complaintPhrase: "dolor de garganta" },
  { code: "fiebre", label: "Fiebre", complaintPhrase: "fiebre" },
  { code: "tos", label: "Tos", complaintPhrase: "tos" },
  { code: "congestion", label: "Congestión / moqueo", complaintPhrase: "congestión nasal" },
  {
    code: "dificultad_respiratoria",
    label: "Falta de aire",
    redFlag: true,
    complaintPhrase: "falta de aire",
  },
  { code: "mareo", label: "Mareo", complaintPhrase: "mareo" },
  {
    code: "desmayo",
    label: "Desmayo / pérdida de conciencia",
    redFlag: true,
    complaintPhrase: "desmayo",
  },
  {
    code: "debilidad",
    label: "Debilidad",
    redFlag: true,
    complaintPhrase: "debilidad",
  },
  {
    code: "entumecimiento",
    label: "Entumecimiento / parálisis",
    redFlag: true,
    complaintPhrase: "entumecimiento o parálisis",
  },
  {
    code: "confusion",
    label: "Confusión / desorientación",
    redFlag: true,
    complaintPhrase: "confusión",
  },
  {
    code: "dificultad_hablar",
    label: "Dificultad para hablar",
    redFlag: true,
    complaintPhrase: "dificultad para hablar",
  },
  { code: "nausea", label: "Náusea / vómito", complaintPhrase: "náuseas y vómito" },
  { code: "diarrea", label: "Diarrea", complaintPhrase: "diarrea" },
  { code: "estrenimiento", label: "Estreñimiento", complaintPhrase: "estreñimiento" },
  { code: "fatiga", label: "Fatiga / cansancio", complaintPhrase: "fatiga" },
  { code: "palpitaciones", label: "Palpitaciones", complaintPhrase: "palpitaciones" },
  {
    code: "sintomas_urinarios",
    label: "Ardor o molestia al orinar",
    complaintPhrase: "ardor al orinar",
  },
  { code: "oido", label: "Dolor de oído", complaintPhrase: "dolor de oído" },
  { code: "ojo_rojo", label: "Ojo rojo / molestia ocular", complaintPhrase: "ojo rojo" },
  { code: "erupcion_piel", label: "Erupción / comezón en piel", complaintPhrase: "erupción en piel" },
  {
    code: "reaccion_alergica",
    label: "Reacción alérgica",
    redFlag: true,
    complaintPhrase: "reacción alérgica",
  },
  {
    code: "hinchazon",
    label: "Hinchazón",
    redFlag: true,
    complaintPhrase: "hinchazón",
  },
  { code: "ansiedad", label: "Ansiedad / crisis nerviosa", complaintPhrase: "ansiedad" },
  { code: "otro", label: "Otro" },
];

export const PAIN_LOCATION_OPTIONS: Array<{
  code: PainLocationCode;
  label: string;
  group: string;
  redFlag?: boolean;
  complaintPhrase: string;
  /** Ocultar en UI nueva (solo compat). */
  legacy?: boolean;
}> = [
  { code: "cabeza", label: "Cabeza", group: "Cabeza y cuello", complaintPhrase: "dolor de cabeza" },
  {
    code: "nuca",
    label: "Nuca",
    group: "Cabeza y cuello",
    complaintPhrase: "dolor de nuca",
  },
  { code: "cuello", label: "Cuello (frente)", group: "Cabeza y cuello", complaintPhrase: "dolor de cuello" },
  {
    code: "cuello_esp",
    label: "Cuello (espalda)",
    group: "Cabeza y cuello",
    complaintPhrase: "dolor de cuello por atrás",
  },
  {
    code: "pecho",
    label: "Pecho",
    group: "Tórax",
    redFlag: true,
    complaintPhrase: "dolor de pecho",
  },
  {
    code: "abdomen_epigastrio",
    label: "Boca del estómago (arriba al centro)",
    group: "Abdomen / estómago",
    complaintPhrase: "dolor en epigastrio boca del estómago",
  },
  {
    code: "abdomen_umbilical",
    label: "Alrededor del ombligo",
    group: "Abdomen / estómago",
    complaintPhrase: "dolor alrededor del ombligo",
  },
  {
    code: "abdomen_bajo",
    label: "Abdomen bajo (hipogastrio)",
    group: "Abdomen / estómago",
    complaintPhrase: "dolor en abdomen bajo",
  },
  {
    code: "abdomen_flanco_dcho",
    label: "Lado derecho del abdomen",
    group: "Abdomen / estómago",
    complaintPhrase: "dolor en flanco derecho del abdomen",
  },
  {
    code: "abdomen_flanco_izq",
    label: "Lado izquierdo del abdomen",
    group: "Abdomen / estómago",
    complaintPhrase: "dolor en flanco izquierdo del abdomen",
  },
  {
    code: "abdomen",
    label: "Estómago / abdomen (general)",
    group: "Abdomen / estómago",
    complaintPhrase: "dolor estomacal",
    legacy: true,
  },
  {
    code: "espalda_alta",
    label: "Espalda alta (general)",
    group: "Espalda",
    complaintPhrase: "dolor de espalda alta",
    legacy: true,
  },
  {
    code: "espalda_media",
    label: "Espalda media (general)",
    group: "Espalda",
    complaintPhrase: "dolor de espalda media",
    legacy: true,
  },
  {
    code: "espalda_lumbar",
    label: "Espalda baja / lumbar (general)",
    group: "Espalda",
    complaintPhrase: "dolor lumbar espalda baja",
    legacy: true,
  },
  {
    code: "omoplato_izq",
    label: "Omóplato izquierdo",
    group: "Espalda",
    complaintPhrase: "dolor en omóplato izquierdo",
  },
  {
    code: "omoplato_der",
    label: "Omóplato derecho",
    group: "Espalda",
    complaintPhrase: "dolor en omóplato derecho",
  },
  {
    code: "dorsal_izq",
    label: "Dorsal izquierda",
    group: "Espalda",
    complaintPhrase: "dolor dorsal izquierdo",
  },
  {
    code: "dorsal_der",
    label: "Dorsal derecha",
    group: "Espalda",
    complaintPhrase: "dolor dorsal derecho",
  },
  {
    code: "lumbar_izq",
    label: "Lumbar izquierda",
    group: "Espalda",
    complaintPhrase: "dolor lumbar izquierdo",
  },
  {
    code: "lumbar_der",
    label: "Lumbar derecha",
    group: "Espalda",
    complaintPhrase: "dolor lumbar derecho",
  },
  {
    code: "espalda",
    label: "Espalda (general)",
    group: "Espalda",
    complaintPhrase: "dolor de espalda",
    legacy: true,
  },
  {
    code: "hombro_izq",
    label: "Hombro izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en hombro izquierdo",
  },
  {
    code: "hombro_der",
    label: "Hombro derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en hombro derecho",
  },
  {
    code: "hombro_izq_esp",
    label: "Hombro izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en hombro izquierdo por atrás",
  },
  {
    code: "hombro_der_esp",
    label: "Hombro derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en hombro derecho por atrás",
  },
  {
    code: "hombros",
    label: "Hombros (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en hombros",
    legacy: true,
  },
  {
    code: "brazo_superior_izq",
    label: "Brazo alto izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en la parte alta del brazo izquierdo",
  },
  {
    code: "brazo_superior_der",
    label: "Brazo alto derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en la parte alta del brazo derecho",
  },
  {
    code: "brazo_superior_izq_esp",
    label: "Brazo alto izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en la parte alta del brazo izquierdo por atrás",
  },
  {
    code: "brazo_superior_der_esp",
    label: "Brazo alto derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en la parte alta del brazo derecho por atrás",
  },
  {
    code: "brazo_superior",
    label: "Parte alta del brazo (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en la parte alta del brazo",
    legacy: true,
  },
  {
    code: "codo_izq",
    label: "Codo izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en codo izquierdo",
  },
  {
    code: "codo_der",
    label: "Codo derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en codo derecho",
  },
  {
    code: "codo_izq_esp",
    label: "Codo izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en codo izquierdo por atrás",
  },
  {
    code: "codo_der_esp",
    label: "Codo derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en codo derecho por atrás",
  },
  {
    code: "codos",
    label: "Codos (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en codos",
    legacy: true,
  },
  {
    code: "antebrazo_izq",
    label: "Antebrazo izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en antebrazo izquierdo",
  },
  {
    code: "antebrazo_der",
    label: "Antebrazo derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en antebrazo derecho",
  },
  {
    code: "antebrazo_izq_esp",
    label: "Antebrazo izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en antebrazo izquierdo por atrás",
  },
  {
    code: "antebrazo_der_esp",
    label: "Antebrazo derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en antebrazo derecho por atrás",
  },
  {
    code: "antebrazos",
    label: "Antebrazos (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en antebrazos",
    legacy: true,
  },
  {
    code: "mano_izq",
    label: "Mano izquierda (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en mano izquierda",
  },
  {
    code: "mano_der",
    label: "Mano derecha (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en mano derecha",
  },
  {
    code: "mano_izq_esp",
    label: "Mano izquierda (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en mano izquierda por atrás",
  },
  {
    code: "mano_der_esp",
    label: "Mano derecha (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en mano derecha por atrás",
  },
  {
    code: "manos",
    label: "Manos / muñecas (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en manos",
    legacy: true,
  },
  {
    code: "gluteo_izq",
    label: "Glúteo izquierdo",
    group: "Extremidades",
    complaintPhrase: "dolor en glúteo izquierdo",
  },
  {
    code: "gluteo_der",
    label: "Glúteo derecho",
    group: "Extremidades",
    complaintPhrase: "dolor en glúteo derecho",
  },
  {
    code: "gluteos",
    label: "Glúteos (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en glúteos",
    legacy: true,
  },
  {
    code: "muslo_izq",
    label: "Muslo izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en muslo izquierdo",
  },
  {
    code: "muslo_der",
    label: "Muslo derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en muslo derecho",
  },
  {
    code: "muslo_izq_esp",
    label: "Muslo izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en muslo izquierdo por atrás",
  },
  {
    code: "muslo_der_esp",
    label: "Muslo derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en muslo derecho por atrás",
  },
  {
    code: "muslos",
    label: "Muslos (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en muslos",
    legacy: true,
  },
  {
    code: "rodilla_izq",
    label: "Rodilla izquierda (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en rodilla izquierda",
  },
  {
    code: "rodilla_der",
    label: "Rodilla derecha (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en rodilla derecha",
  },
  {
    code: "rodilla_izq_esp",
    label: "Rodilla izquierda (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en rodilla izquierda por atrás",
  },
  {
    code: "rodilla_der_esp",
    label: "Rodilla derecha (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en rodilla derecha por atrás",
  },
  {
    code: "rodillas",
    label: "Rodillas (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en rodillas",
    legacy: true,
  },
  {
    code: "espinilla_izq",
    label: "Espinilla izquierda (frente de la pierna)",
    group: "Extremidades",
    complaintPhrase: "dolor en espinilla izquierda",
  },
  {
    code: "espinilla_der",
    label: "Espinilla derecha (frente de la pierna)",
    group: "Extremidades",
    complaintPhrase: "dolor en espinilla derecha",
  },
  {
    code: "pantorrilla_izq",
    label: "Pantorrilla izquierda (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en pantorrilla izquierda",
    legacy: true,
  },
  {
    code: "pantorrilla_der",
    label: "Pantorrilla derecha (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en pantorrilla derecha",
    legacy: true,
  },
  {
    code: "pantorrilla_izq_esp",
    label: "Pantorrilla izquierda (atrás de la pierna)",
    group: "Extremidades",
    complaintPhrase: "dolor en pantorrilla izquierda",
  },
  {
    code: "pantorrilla_der_esp",
    label: "Pantorrilla derecha (atrás de la pierna)",
    group: "Extremidades",
    complaintPhrase: "dolor en pantorrilla derecha",
  },
  {
    code: "pantorrillas",
    label: "Pantorrillas (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en pantorrillas",
    legacy: true,
  },
  {
    code: "tobillo_izq",
    label: "Tobillo izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en tobillo izquierdo",
  },
  {
    code: "tobillo_der",
    label: "Tobillo derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en tobillo derecho",
  },
  {
    code: "tobillo_izq_esp",
    label: "Tobillo izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en tobillo izquierdo por atrás",
  },
  {
    code: "tobillo_der_esp",
    label: "Tobillo derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en tobillo derecho por atrás",
  },
  {
    code: "pie_izq",
    label: "Pie izquierdo (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en pie izquierdo",
  },
  {
    code: "pie_der",
    label: "Pie derecho (frente)",
    group: "Extremidades",
    complaintPhrase: "dolor en pie derecho",
  },
  {
    code: "pie_izq_esp",
    label: "Pie izquierdo (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en pie izquierdo por atrás",
  },
  {
    code: "pie_der_esp",
    label: "Pie derecho (espalda)",
    group: "Extremidades",
    complaintPhrase: "dolor en pie derecho por atrás",
  },
  {
    code: "pies",
    label: "Pies (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en pies",
    legacy: true,
  },
  {
    code: "brazos",
    label: "Brazos (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en brazos",
    legacy: true,
  },
  {
    code: "piernas",
    label: "Piernas (general)",
    group: "Extremidades",
    complaintPhrase: "dolor en piernas",
    legacy: true,
  },
  {
    code: "articulaciones",
    label: "Articulaciones",
    group: "Extremidades",
    complaintPhrase: "dolor articular",
  },
  {
    code: "generalizado",
    label: "Todo el cuerpo",
    group: "General",
    complaintPhrase: "dolor generalizado",
  },
];

/** Opciones visibles en el kiosco (sin legacy). */
export const PAIN_LOCATION_UI_OPTIONS = PAIN_LOCATION_OPTIONS.filter((o) => !o.legacy);

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
  return selection.primary.includes("dolor") || selection.primary.includes("ardor");
}

function bodyLocationSenseLabel(selection: SymptomSelection): string {
  const hasDolor = selection.primary.includes("dolor");
  const hasArdor = selection.primary.includes("ardor");
  if (hasDolor && hasArdor) return "Dolor / Ardor";
  if (hasArdor) return "Ardor";
  return "Dolor";
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
  if (selection.primary.includes("desmayo")) {
    flags.push("Desmayo / pérdida de conciencia — valoración médica inmediata");
  }
  if (selection.primary.includes("confusion")) {
    flags.push("Confusión / desorientación nueva — valoración urgente");
  }
  if (selection.primary.includes("dificultad_hablar")) {
    flags.push("Dificultad para hablar — posible evento neurológico (valorar ACV)");
  }
  if (selection.primary.includes("entumecimiento")) {
    flags.push("Entumecimiento / parálisis — posible evento neurológico");
  }
  if (selection.primary.includes("debilidad")) {
    const inten = selection.symptomDetails.debilidad?.intensity;
    if (inten === "intensa" || inten === "moderada") {
      flags.push("Debilidad significativa — valoración médica");
    } else {
      flags.push("Debilidad reportada — descartar causa neurológica/metabólica");
    }
  }
  if (selection.primary.includes("reaccion_alergica")) {
    flags.push("Reacción alérgica — valorar anafilaxia / vía aérea");
  }
  if (selection.primary.includes("hinchazon")) {
    flags.push("Hinchazón — si es cara, labios o garganta: emergencia");
  }

  if (selection.painLocations.includes("pecho")) {
    flags.push("Dolor de pecho seleccionado");
    if (selection.painDetails.pecho?.intensity === "intensa") {
      flags.push("Dolor torácico intenso");
    }
  }

  const abdominalIntense = (
    [
      "abdomen_epigastrio",
      "abdomen_umbilical",
      "abdomen_bajo",
      "abdomen_flanco_dcho",
      "abdomen_flanco_izq",
      "abdomen",
    ] as const
  ).some((loc) => selection.painLocations.includes(loc) && selection.painDetails[loc]?.intensity === "intensa");
  if (abdominalIntense) {
    flags.push("Dolor abdominal intenso — evaluación urgente");
  }

  if (
    selection.painLocations.includes("abdomen_flanco_dcho") &&
    selection.painDetails.abdomen_flanco_dcho?.intensity === "intensa"
  ) {
    flags.push("Dolor intenso en flanco derecho (valorar abdomen agudo)");
  }

  return flags;
}

/** Síntomas que deben forzar teleconsulta / no receta autónoma. */
export function hasImmediateEscalationSymptoms(selection: SymptomSelection): boolean {
  return detectSymptomRedFlags(selection).length > 0;
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

  if (selection.primary.includes("ardor")) {
    if (selection.painLocations.length > 0) {
      for (const loc of selection.painLocations) {
        const opt = PAIN_LOCATION_OPTIONS.find((o) => o.code === loc);
        if (!opt) continue;
        const phrase = `ardor en ${opt.label.toLowerCase()}`;
        const extra = detailPhrase(selection.painDetails[loc]);
        parts.push(extra ? `${phrase} (${extra})` : phrase);
      }
    } else {
      parts.push("ardor");
    }
  }

  for (const code of selection.primary) {
    if (code === "dolor" || code === "ardor" || code === "otro") continue;
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

  if (needsPainLocation(selection) && selection.painLocations.length === 0) {
    const sense = bodyLocationSenseLabel(selection);
    gaps.push(
      `Indicaste ${sense}: elija dónde lo siente en el cuerpo (sea lo más específico posible)`,
    );
  }

  if (needsPainLocation(selection)) {
    const sense = bodyLocationSenseLabel(selection);
    for (const loc of selection.painLocations) {
      const msg = detailGapMessage(`${sense} en ${painLabel(loc)}`, selection.painDetails[loc]);
      if (msg) gaps.push(msg);
    }
  }

  for (const code of selection.primary) {
    if (code === "dolor" || code === "ardor") continue;
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
  if (needsPainLocation(selection)) {
    for (const loc of selection.painLocations) {
      if (!isDetailComplete(selection.painDetails[loc])) keys.add(`pain-${loc}`);
    }
  }
  for (const code of selection.primary) {
    if (code === "dolor" || code === "ardor") continue;
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
      if (code === "dolor" || code === "ardor") continue;
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
