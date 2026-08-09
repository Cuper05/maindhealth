import type { KioskVitalsDraft } from "@/lib/db/schema/station-kiosk";
import type { ProtocolMedication } from "@/lib/db/schema/station-commerce";
import { normalizeAssessmentText } from "@/lib/kiosk/assessment-text";
import { listActiveProtocols, matchProtocolByComplaint } from "@/lib/kiosk/commerce";

export { displayTreatmentPlan, normalizeAssessmentText } from "@/lib/kiosk/assessment-text";

export type AssessmentMedication = ProtocolMedication;

export type ClinicalAssessment = {
  diagnosis: string;
  severity: "low" | "moderate" | "high" | "critical";
  requiresDoctor: boolean;
  summary: string;
  treatmentPlan: string;
  instructions: string;
  redFlags: string[];
  medications: AssessmentMedication[];
  engine: "rules" | "openai";
  protocolCode: string | null;
  protocolName: string | null;
  /** Solo true si hay protocolo preautorizado y sin banderas rojas. */
  prescriptionAuthorized: boolean;
};

type ClinicalInput = {
  chiefComplaint: string;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasAsthma: boolean;
  hasHeartDisease: boolean;
  hasAllergies: boolean;
  allergyDetails?: string;
  currentMedications?: string;
  vitals: KioskVitalsDraft;
};

function num(value?: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function collectRedFlags(input: ClinicalInput): string[] {
  const complaint = input.chiefComplaint.trim().toLowerCase();
  const systolic = num(input.vitals.systolicPressure);
  const diastolic = num(input.vitals.diastolicPressure);
  const heartRate = num(input.vitals.heartRate);
  const spo2 = num(input.vitals.oxygenSaturation);
  const temperature = num(input.vitals.temperature);
  const redFlags: string[] = [];

  if (systolic != null && systolic >= 180) redFlags.push("Crisis hipertensiva (presión sistólica muy elevada)");
  if (diastolic != null && diastolic >= 120) redFlags.push("Crisis hipertensiva (presión diastólica muy elevada)");
  if (systolic != null && systolic < 90) redFlags.push("Hipotensión severa");
  if (heartRate != null && heartRate >= 130) redFlags.push("Taquicardia severa");
  if (heartRate != null && heartRate > 0 && heartRate <= 40) redFlags.push("Bradicardia severa");
  if (spo2 != null && spo2 < 92) redFlags.push("Hipoxemia (oxigenación baja)");
  if (temperature != null && temperature >= 39.5) redFlags.push("Fiebre alta");
  if (temperature != null && temperature > 0 && temperature <= 35) redFlags.push("Hipotermia");

  if (includesAny(complaint, ["dolor de pecho", "dolor pecho", "opresion", "opresión", "infarto"])) {
    redFlags.push("Dolor torácico sugerente de urgencia");
  }
  if (includesAny(complaint, ["falta de aire", "dificultad para respirar", "no puedo respirar", "ahogo"])) {
    redFlags.push("Dificultad respiratoria");
  }
  if (includesAny(complaint, ["desmayo", "convulsion", "convulsión", "paralisis", "parálisis", "no mueve"])) {
    redFlags.push("Síntomas neurológicos de alarma");
  }
  if (includesAny(complaint, ["sangrado abundante", "hemorragia", "vomito de sangre", "vómito de sangre"])) {
    redFlags.push("Sangrado potencialmente grave");
  }
  if (includesAny(complaint, ["anafilaxia", "hinchazon de garganta", "hinchazón de garganta", "no trago"])) {
    redFlags.push("Posible reacción alérgica severa");
  }
  if (input.hasHeartDisease && (includesAny(complaint, ["dolor de pecho", "dolor pecho"]) || (systolic != null && systolic >= 160))) {
    redFlags.push("Antecedente cardiaco con síntomas de riesgo");
  }
  if (input.hasAsthma && (includesAny(complaint, ["falta de aire", "ahogo"]) || (spo2 != null && spo2 < 94))) {
    redFlags.push("Asma con compromiso respiratorio");
  }

  return redFlags;
}

function filterMedsForAllergies(meds: ProtocolMedication[], input: ClinicalInput) {
  if (!input.hasAllergies) return meds;
  const details = (input.allergyDetails ?? "").toLowerCase();
  return meds.filter((m) => {
    const name = m.medication.toLowerCase();
    if (includesAny(details, ["paracetamol", "acetaminofen", "acetaminofén"]) && name.includes("paracetamol")) {
      return false;
    }
    if (
      includesAny(details, ["aine", "ibuprofeno", "naproxeno", "aspirina", "aas"]) &&
      includesAny(name, ["ibuprofeno", "naproxeno", "aspirina"])
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Motor clínico Fase 1:
 * - Detecta banderas rojas (escala a médico)
 * - Solo autoriza receta si hay protocolo preautorizado que haga match
 * - OpenAI puede enriquecer texto, pero NO inventa medicamentos fuera de protocolo
 */
export async function assessClinicalCase(input: ClinicalInput): Promise<ClinicalAssessment> {
  const redFlags = collectRedFlags(input);
  const protocols = await listActiveProtocols();
  const matched = matchProtocolByComplaint(input.chiefComplaint, protocols);

  if (redFlags.length > 0) {
    return {
      diagnosis: "Cuadro clínico de riesgo que requiere evaluación médica remota",
      severity: redFlags.some((f) => /crisis|hipoxemia|torácico|neurológ|anafil|hemorragia|hipotermia/i.test(f))
        ? "critical"
        : "high",
      requiresDoctor: true,
      summary:
        "Se detectaron signos o síntomas de posible gravedad. No se emite receta automática. Se abrirá conexión con un médico.",
      treatmentPlan:
        "No se aplica protocolo autónomo. Permanece en la estación para valoración médica en vivo.",
      instructions:
        "Si empeoras (dolor intenso, desmayo, dificultad severa para respirar), solicita ayuda inmediata o acude a urgencias.",
      redFlags,
      medications: [],
      engine: "rules",
      protocolCode: null,
      protocolName: null,
      prescriptionAuthorized: false,
    };
  }

  if (!matched) {
    return {
      diagnosis: "Evaluación preliminar sin protocolo preautorizado aplicable",
      severity: "moderate",
      requiresDoctor: true,
      summary:
        "Tus signos vitales no muestran alarma crítica, pero el motivo de consulta no coincide con un protocolo preautorizado para emitir receta automática.",
      treatmentPlan: "Se requiere revisión médica remota antes de indicar tratamiento farmacológico.",
      instructions: "Un médico revisará tu caso. Mientras tanto, hidrátate y permanece en la estación.",
      redFlags: [],
      medications: [],
      engine: "rules",
      protocolCode: null,
      protocolName: null,
      prescriptionAuthorized: false,
    };
  }

  const medications = filterMedsForAllergies(matched.medications ?? [], input);
  if (medications.length === 0 && (matched.medications?.length ?? 0) > 0) {
    return {
      diagnosis: matched.diagnosisLabel ?? matched.name,
      severity: "moderate",
      requiresDoctor: true,
      summary:
        "El caso podría entrar en un protocolo, pero hay posible contraindicación/alergia. Se requiere médico.",
      treatmentPlan: "Revisión médica para ajustar tratamiento seguro.",
      instructions: "Indica al médico tus alergias y medicamentos actuales.",
      redFlags: ["Posible contraindicación medicamentosa"],
      medications: [],
      engine: "rules",
      protocolCode: matched.code,
      protocolName: matched.name,
      prescriptionAuthorized: false,
    };
  }

  const base: ClinicalAssessment = {
    diagnosis: matched.diagnosisLabel ?? matched.name,
    severity: "low",
    requiresDoctor: false,
    summary: `Evaluación preliminar asistida por IA dentro del protocolo preautorizado «${matched.name}».`,
    treatmentPlan: matched.treatmentPlan ?? "Seguir indicaciones del protocolo autorizado.",
    instructions:
      matched.instructions ??
      "Si aparecen signos de alarma (dolor de pecho, falta de aire, desmayo, fiebre alta), regresa a la estación o acude a urgencias.",
    redFlags: [],
    medications,
    engine: "rules",
    protocolCode: matched.code,
    protocolName: matched.name,
    prescriptionAuthorized: medications.length > 0,
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return base;

  try {
    const enriched = await enrichWithOpenAI(input, base, apiKey);
    return enriched ?? base;
  } catch (err) {
    console.warn("[kiosk/assess] OpenAI fallback to rules:", err);
    return base;
  }
}

async function enrichWithOpenAI(
  input: ClinicalInput,
  base: ClinicalAssessment,
  apiKey: string,
): Promise<ClinicalAssessment | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres apoyo clínico de una estación de telemedicina en México. El caso YA está dentro de un protocolo preautorizado. Responde SOLO JSON con: summary, treatmentPlan, instructions. NO inventes medicamentos. NO cambies el diagnóstico a algo grave. Mantén tono claro para el paciente.",
          },
          {
            role: "user",
            content: JSON.stringify({
              symptoms: input,
              protocol: {
                code: base.protocolCode,
                name: base.protocolName,
                diagnosis: base.diagnosis,
                medications: base.medications,
              },
            }),
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[kiosk/assess] OpenAI HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Partial<ClinicalAssessment>;
    return {
      ...base,
      summary: normalizeAssessmentText(parsed.summary, base.summary),
      treatmentPlan: normalizeAssessmentText(parsed.treatmentPlan, base.treatmentPlan),
      instructions: normalizeAssessmentText(parsed.instructions, base.instructions),
      engine: "openai",
      // Medicamentos siempre del protocolo, nunca de OpenAI
      medications: base.medications,
      prescriptionAuthorized: base.prescriptionAuthorized,
      protocolCode: base.protocolCode,
      protocolName: base.protocolName,
      requiresDoctor: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}
