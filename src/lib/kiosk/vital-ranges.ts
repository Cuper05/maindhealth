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
  temperature: "Temperatura axilar normal: 36.0 – 37.5 °C",
  ecg: "ECG: el ritmo lo interpreta el equipo / médico",
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

export function interpretEcg(
  ecgStatus?: string | null,
  ecgRhythm?: string | null,
): VitalReadingView | null {
  if (!ecgStatus) return null;
  if (ecgStatus === "skipped") {
    return {
      label: "ECG",
      valueText: "Pendiente",
      normalRange: VITAL_RANGE_COPY.ecg,
      band: "info",
      verdict: "Sin lectura en esta visita",
    };
  }
  const rhythm = (ecgRhythm ?? "ECG registrado").trim();
  const lower = rhythm.toLowerCase();
  const looksNormal =
    lower.includes("sinusal") || lower.includes("normal") || lower.includes("regular");
  return {
    label: "ECG",
    valueText: rhythm,
    normalRange: VITAL_RANGE_COPY.ecg,
    band: looksNormal ? "normal" : "info",
    verdict: looksNormal
      ? "Ritmo descrito como normal / sinusal"
      : "Registrado — el médico lo revisará",
  };
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
