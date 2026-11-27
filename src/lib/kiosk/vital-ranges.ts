/**
 * Rangos de referencia para adultos en reposo (orientativos).
 * Alineados con `getVitalAlerts` en reports/vital-alerts.ts.
 * No sustituyen la valoración médica.
 */

export type VitalBand = "normal" | "low" | "high" | "info";

export type VitalReadingView = {
  label: string;
  valueText: string;
  normalRange: string;
  band: VitalBand;
  /** Texto corto para el paciente */
  verdict: string;
};

function num(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function bandFor(value: number, min: number, max: number): VitalBand {
  if (value < min) return "low";
  if (value > max) return "high";
  return "normal";
}

function verdictFor(band: VitalBand, lowLabel: string, highLabel: string): string {
  if (band === "normal") return "Dentro del rango normal";
  if (band === "low") return lowLabel;
  if (band === "high") return highLabel;
  return "Referencia";
}

/** Texto de rango normal mostrado en pantallas del kiosco. */
export const VITAL_RANGE_COPY = {
  weight: "Peso: varía por persona · se interpreta con la altura (IMC)",
  height: "Altura: solo referencia corporal",
  bmi: "IMC normal adulto: 18.5 – 24.9",
  bloodPressure: "Presión normal adulto en reposo: 90–140 / 60–90 mmHg",
  heartRate: "Pulso normal adulto en reposo: 60 – 100 lpm",
  spo2: "Oxígeno (SpO₂) normal: 94 – 100 %",
  temperature: "Temperatura en la frente, normal: 36.0 – 37.5 °C",
  ecg: "ECG: cribado del trazado (FC estimada, ritmo) · no es diagnóstico · el médico interpreta",
  ecgHr: "FC estimada del trazado (adulto en reposo): 60 – 100 lpm",
  disclaimer:
    "Rangos orientativos para adultos en reposo. El médico interpreta su caso completo.",
} as const;

export function interpretBloodPressure(
  systolic?: string | null,
  diastolic?: string | null,
): VitalReadingView | null {
  const sys = num(systolic);
  const dia = num(diastolic);
  if (sys == null || dia == null) return null;

  const sysBand = bandFor(sys, 90, 140);
  const diaBand = bandFor(dia, 60, 90);
  let band: VitalBand = "normal";
  if (sysBand === "high" || diaBand === "high") band = "high";
  else if (sysBand === "low" || diaBand === "low") band = "low";

  return {
    label: "Presión arterial",
    valueText: `${sys}/${dia} mmHg`,
    normalRange: "90–140 / 60–90 mmHg",
    band,
    verdict: verdictFor(band, "Por debajo del rango (hipotensión)", "Por encima del rango (hipertensión)"),
  };
}

export function interpretHeartRate(heartRate?: string | null): VitalReadingView | null {
  const hr = num(heartRate);
  if (hr == null) return null;
  const band = bandFor(hr, 60, 100);
  return {
    label: "Pulso",
    valueText: `${hr} lpm`,
    normalRange: "60–100 lpm",
    band,
    verdict: verdictFor(band, "Por debajo del rango (bradicardia)", "Por encima del rango (taquicardia)"),
  };
}

export function interpretSpo2(oxygenSaturation?: string | null): VitalReadingView | null {
  const spo2 = num(oxygenSaturation);
  if (spo2 == null) return null;
  const band = spo2 < 94 ? "low" : spo2 > 100 ? "high" : "normal";
  return {
    label: "Oxígeno (SpO₂)",
    valueText: `${spo2} %`,
    normalRange: "94–100 %",
    band,
    verdict: verdictFor(band, "Por debajo del rango (oxígeno bajo)", "Fuera de rango esperado"),
  };
}

export function interpretTemperature(temperature?: string | null): VitalReadingView | null {
  const t = num(temperature);
  if (t == null) return null;
  const band = bandFor(t, 36, 37.5);
  return {
    label: "Temperatura",
    valueText: `${t} °C`,
    normalRange: "36.0–37.5 °C",
    band,
    verdict: verdictFor(band, "Por debajo del rango (hipotermia)", "Por encima del rango (fiebre)"),
  };
}

export function interpretBmi(bmi?: string | null): VitalReadingView | null {
  const v = num(bmi);
  if (v == null) return null;
  let band: VitalBand = "normal";
  let verdict = "IMC en rango normal";
  if (v < 18.5) {
    band = "low";
    verdict = "Por debajo del rango (bajo peso)";
  } else if (v >= 30) {
    band = "high";
    verdict = "Por encima del rango (obesidad)";
  } else if (v >= 25) {
    band = "high";
    verdict = "Por encima del rango (sobrepeso)";
  }
  return {
    label: "IMC",
    valueText: String(v),
    normalRange: "18.5–24.9",
    band,
    verdict,
  };
}

export function interpretWeight(weight?: string | null): VitalReadingView | null {
  const w = num(weight);
  if (w == null) return null;
  return {
    label: "Peso",
    valueText: `${w} kg`,
    normalRange: "Se interpreta con la altura (IMC)",
    band: "info",
    verdict: "Registrado — vea el IMC",
  };
}

export function interpretHeight(height?: string | null): VitalReadingView | null {
  const h = num(height);
  if (h == null) return null;
  const cm = h > 3 ? h : h * 100;
  return {
    label: "Altura",
    valueText: `${cm.toFixed(1)} cm`,
    normalRange: "Referencia corporal",
    band: "info",
    verdict: "Registrada",
  };
}

function parseEcgFlagList(ecgFlags?: string | null): string[] {
  return (ecgFlags ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** FC estimada desde picos R del trazado (no pulso del oxímetro). */
export function interpretEcgHeartRate(
  ecgEstimatedHr?: string | null,
  ecgQuality?: string | null,
  ecgFlags?: string | null,
): VitalReadingView | null {
  const flags = parseEcgFlagList(ecgFlags);
  const poor = ecgQuality === "poor" || flags.includes("poor_signal");
  const hr = num(ecgEstimatedHr);
  if (hr == null) {
    return {
      label: "FC (ECG)",
      valueText: poor ? "N/D" : "—",
      normalRange: VITAL_RANGE_COPY.ecgHr,
      band: "info",
      verdict: poor
        ? "Sin FC estimable — repetir medición"
        : "Trazado sin FC estimada clara",
    };
  }
  const band = bandFor(hr, 60, 100);
  return {
    label: "FC (ECG)",
    valueText: `${hr} lpm`,
    normalRange: VITAL_RANGE_COPY.ecgHr,
    band,
    verdict: verdictFor(
      band,
      "Por debajo del rango (posible bradicardia)",
      "Por encima del rango (posible taquicardia)",
    ),
  };
}

/** Hallazgo de cribado sobre la onda (ritmo / calidad / FA sospechada). */
export function interpretEcgAnalysis(
  ecgStatus?: string | null,
  ecgQuality?: string | null,
  ecgFlags?: string | null,
  ecgRhythm?: string | null,
): VitalReadingView | null {
  if (!ecgStatus) return null;
  if (ecgStatus === "skipped") {
    return {
      label: "Análisis ECG",
      valueText: "Pendiente",
      normalRange: VITAL_RANGE_COPY.ecg,
      band: "info",
      verdict: "Sin lectura en esta visita",
    };
  }

  const flags = parseEcgFlagList(ecgFlags);
  const poor = ecgQuality === "poor" || flags.includes("poor_signal");
  const clinical = flags.some((f) =>
    ["bradycardia", "tachycardia", "irregular", "possible_af"].includes(f),
  );

  let valueText = "Ritmo aparente regular";
  if (poor) valueText = "Señal insuficiente";
  else if (flags.includes("possible_af")) valueText = "Sospecha irreg. tipo FA";
  else if (flags.includes("irregular")) valueText = "Ritmo irregular";
  else if (flags.includes("bradycardia")) valueText = "Posible bradicardia";
  else if (flags.includes("tachycardia")) valueText = "Posible taquicardia";
  else if (ecgQuality === "fair") valueText = "Calidad aceptable";

  let band: VitalBand = "normal";
  if (poor) band = "info";
  else if (clinical) band = "high";
  else if (ecgQuality === "fair" || flags.includes("hr_mismatch")) band = "info";

  void ecgRhythm;
  return {
    label: "Análisis ECG",
    valueText,
    normalRange: VITAL_RANGE_COPY.ecg,
    band,
    verdict: poor
      ? "Señal insuficiente — conviene repetir"
      : clinical
        ? "Cribado con hallazgo — el médico lo revisará"
        : "Sin hallazgos de cribado — el médico interpreta el caso",
  };
}

/** Vistas del paso ECG: FC del trazado + análisis (sin pulso del oxímetro). */
export function buildEcgReadingViews(
  ecgStatus?: string | null,
  ecgRhythm?: string | null,
  ecgQuality?: string | null,
  ecgFlags?: string | null,
  ecgEstimatedHr?: string | null,
): VitalReadingView[] {
  if (!ecgStatus) return [];
  if (ecgStatus === "skipped") {
    const skipped = interpretEcgAnalysis(ecgStatus);
    return skipped ? [skipped] : [];
  }
  const views: VitalReadingView[] = [];
  const hr = interpretEcgHeartRate(ecgEstimatedHr, ecgQuality, ecgFlags);
  const analysis = interpretEcgAnalysis(
    ecgStatus,
    ecgQuality,
    ecgFlags,
    ecgRhythm,
  );
  if (hr) views.push(hr);
  if (analysis) views.push(analysis);
  return views;
}

export function interpretEcg(
  ecgStatus?: string | null,
  ecgRhythm?: string | null,
  ecgQuality?: string | null,
  ecgFlags?: string | null,
  ecgEstimatedHr?: string | null,
): VitalReadingView | null {
  const views = buildEcgReadingViews(
    ecgStatus,
    ecgRhythm,
    ecgQuality,
    ecgFlags,
    ecgEstimatedHr,
  );
  if (!views.length) return null;
  // Resumen compacto (panel médico / lista): prioriza el análisis.
  return views.find((v) => v.label === "Análisis ECG") ?? views[0]!;
}

export function bandTone(band: VitalBand): {
  box: string;
  badge: string;
  value: string;
} {
  switch (band) {
    case "normal":
      return {
        box: "border-emerald-300 bg-emerald-50",
        badge: "bg-emerald-600 text-white",
        value: "text-emerald-950",
      };
    case "low":
    case "high":
      return {
        box: "border-amber-400 bg-amber-50",
        badge: "bg-amber-600 text-white",
        value: "text-amber-950",
      };
    default:
      return {
        box: "border-[#1d6eb8]/30 bg-[#f0f7ff]",
        badge: "bg-[#1d6eb8] text-white",
        value: "text-slate-900",
      };
  }
}
