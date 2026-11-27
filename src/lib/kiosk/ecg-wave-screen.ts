/**
 * Cribado automático de onda ECG (MD100C_P / ChoiceMMed ~120 Hz).
 * Ayuda no diagnóstica para el médico — no sustituye interpretación clínica.
 */

export type EcgWaveQuality = "good" | "fair" | "poor";

export type EcgScreenFlag =
  | "poor_signal"
  | "bradycardia"
  | "tachycardia"
  | "irregular"
  | "possible_af"
  | "hr_mismatch";

export type EcgWaveScreenResult = {
  quality: EcgWaveQuality;
  estimatedHr: number | null;
  peakCount: number;
  flags: EcgScreenFlag[];
  summaryEs: string;
  disclaimerEs: string;
};

export const ECG_SCREEN_DISCLAIMER =
  "Cribado automático del trazado (lead de dedos). No es diagnóstico; el médico interpreta el caso.";

/**
 * Tras filtrar el constante ~34, la tasa útil del MD100C_P es ~60 Hz
 * (antes ~120 Hz con el canal de relleno).
 */
const DEFAULT_SAMPLE_RATE_HZ = 60;
/** ~1.5 s a 60 Hz; no exigir 360 pts (umbral viejo a 120 Hz). */
const MIN_SAMPLES_FOR_SCREEN = 90;

/**
 * Protocolos de cribado sobre la onda (adulto en reposo, lead de dedos).
 * Referencia habitual: FC reposo ~60–100 lpm (p. ej. rangos adultos AHA/ACC).
 * Irregularidad / sospecha FA = heurística de variabilidad RR (CV / RMSSD);
 * no sustituye ECG de 12 derivaciones, Holter ni diagnóstico clínico.
 */
export const ECG_SCREEN_THRESHOLDS = {
  bradycardiaBpm: 60,
  tachycardiaBpm: 100,
  /** Coeficiente de variación RR para marcar irregular. */
  rrCvIrregular: 0.22,
  rmssdNormIrregular: 0.2,
  /** Umbrales más altos → sospecha tipo FA (solo cribado). */
  rrCvPossibleAf: 0.28,
  rmssdNormPossibleAf: 0.24,
  minPeaksForAfSuspect: 8,
  /** Desacuerdo FC trazado vs oxímetro (flag auxiliar). */
  hrMismatchBpm: 15,
} as const;

export type AnalyzeEcgWaveOptions = {
  sampleRateHz?: number;
  oximeterHr?: number | null;
};

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function movingAverage(samples: number[], window: number): number[] {
  const w = Math.max(3, window | 0);
  const half = Math.floor(w / 2);
  const out: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= samples.length) continue;
      sum += samples[j]!;
      n++;
    }
    out.push(sum / n);
  }
  return out;
}

/** Señal centrada (resta media móvil lenta). */
function detrend(samples: number[], sampleRateHz: number): number[] {
  const win = Math.max(5, Math.round(sampleRateHz * 0.4));
  const baseline = movingAverage(samples, win);
  return samples.map((v, i) => v - baseline[i]!);
}

/**
 * Picos R aproximados: máximos locales sobre umbral adaptativo,
 * con distancia mínima ~0.28 s (FC máx ~214).
 */
function findPeaks(detrended: number[], sampleRateHz: number): number[] {
  // Con buffer corto (tras filtrar ~34) no exigir 1 s completo.
  if (detrended.length < Math.max(40, Math.round(sampleRateHz * 0.6))) return [];

  // Solo picos positivos fuertes (R); evita contar P/T como latido.
  const positives = detrended.filter((v) => v > 0);
  if (positives.length < 8) return [];
  const peakFloor = Math.max(
    percentile(positives, 88) * 0.55,
    median(positives) + 1.2 * std(positives),
  );
  const minDist = Math.max(8, Math.round(sampleRateHz * 0.32)); // ~187 lpm máx

  const candidates: { i: number; v: number }[] = [];
  for (let i = 2; i < detrended.length - 2; i++) {
    const v = detrended[i]!;
    if (v < peakFloor) continue;
    if (v >= detrended[i - 1]! && v >= detrended[i + 1]! && v >= detrended[i - 2]! && v >= detrended[i + 2]!) {
      candidates.push({ i, v });
    }
  }

  candidates.sort((a, b) => b.v - a.v);
  const chosen: number[] = [];
  for (const c of candidates) {
    if (chosen.every((p) => Math.abs(p - c.i) >= minDist)) {
      chosen.push(c.i);
    }
  }
  return chosen.sort((a, b) => a - b);
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[idx]!;
}

function assessQuality(
  samples: number[],
  peaks: number[],
  sampleRateHz: number,
): EcgWaveQuality {
  const durationSec = samples.length / sampleRateHz;
  if (samples.length < MIN_SAMPLES_FOR_SCREEN || durationSec < 1.2) return "poor";

  const span = Math.max(...samples) - Math.min(...samples);
  const s = std(samples);
  if (span < 5 || s < 1.2) return "poor";

  // Clip: umbral alto (señales 8-bit disparaban falsos "poor").
  const lo = Math.min(...samples);
  const hi = Math.max(...samples);
  const nearClip = samples.filter((v) => v <= lo + 1 || v >= hi - 1).length;
  if (nearClip / samples.length > 0.55) return "poor";

  const expectedMinPeaks = Math.max(2, Math.floor(durationSec * 0.45));
  if (peaks.length < expectedMinPeaks) return "poor";

  const expectedNominal = durationSec * (72 / 60);
  if (peaks.length < expectedNominal * 0.25) return "fair";
  if (s < 4) return "fair";
  return "good";
}

function flagLabel(flag: EcgScreenFlag): string {
  switch (flag) {
    case "poor_signal":
      return "señal insuficiente";
    case "bradycardia":
      return "posible bradicardia (FC estimada < 60 lpm)";
    case "tachycardia":
      return "posible taquicardia (FC estimada > 100 lpm)";
    case "irregular":
      return "ritmo irregular";
    case "possible_af":
      return "sospecha de irregularidad tipo FA";
    case "hr_mismatch":
      return "FC trazado ≠ pulso oxímetro";
  }
}

export function analyzeEcgWave(
  samplesInput: number[] | undefined | null,
  options: AnalyzeEcgWaveOptions = {},
): EcgWaveScreenResult {
  const sampleRateHz = options.sampleRateHz ?? DEFAULT_SAMPLE_RATE_HZ;
  const samples = (samplesInput ?? []).filter((n) => Number.isFinite(n));
  const disclaimerEs = ECG_SCREEN_DISCLAIMER;

  if (samples.length < MIN_SAMPLES_FOR_SCREEN) {
    return {
      quality: "poor",
      estimatedHr: null,
      peakCount: 0,
      flags: ["poor_signal"],
      summaryEs: "Trazado insuficiente para cribado — repetir medición",
      disclaimerEs,
    };
  }

  const detrended = detrend(samples, sampleRateHz);
  const peaks = findPeaks(detrended, sampleRateHz);
  const quality = assessQuality(samples, peaks, sampleRateHz);

  if (quality === "poor") {
    return {
      quality,
      estimatedHr: null,
      peakCount: peaks.length,
      flags: ["poor_signal"],
      summaryEs: "Señal de mala calidad — repetir con dedos firmes en las placas",
      disclaimerEs,
    };
  }

  const rr: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    rr.push((peaks[i]! - peaks[i - 1]!) / sampleRateHz);
  }

  let estimatedHr: number | null = null;
  if (rr.length >= 2) {
    const medRr = median(rr);
    if (medRr > 0.25 && medRr < 2.2) {
      estimatedHr = Math.round(60 / medRr);
    }
  }

  const flags: EcgScreenFlag[] = [];

  // Capa 2–3: umbrales de protocolo (solo si hay RR suficientes).
  const T = ECG_SCREEN_THRESHOLDS;
  if (rr.length >= 3 && estimatedHr != null) {
    if (estimatedHr < T.bradycardiaBpm) flags.push("bradycardia");
    if (estimatedHr > T.tachycardiaBpm) flags.push("tachycardia");

    const rrMean = mean(rr);
    const rrStd = std(rr);
    const cv = rrMean > 0 ? rrStd / rrMean : 0;
    const diffs: number[] = [];
    for (let i = 1; i < rr.length; i++) {
      diffs.push((rr[i]! - rr[i - 1]!) ** 2);
    }
    const rmssd = diffs.length ? Math.sqrt(mean(diffs)) : 0;
    const rmssdNorm = rrMean > 0 ? rmssd / rrMean : 0;

    const irregular =
      cv > T.rrCvIrregular || rmssdNorm > T.rmssdNormIrregular;
    if (irregular) {
      flags.push("irregular");
      // Sospecha FA (cribado): irregularidad alta + varios latidos.
      if (
        cv > T.rrCvPossibleAf &&
        rmssdNorm > T.rmssdNormPossibleAf &&
        peaks.length >= T.minPeaksForAfSuspect
      ) {
        flags.push("possible_af");
      }
    }
  }

  const ox = options.oximeterHr;
  if (
    estimatedHr != null &&
    ox != null &&
    Number.isFinite(ox) &&
    ox >= 30 &&
    ox <= 250 &&
    Math.abs(estimatedHr - ox) > T.hrMismatchBpm
  ) {
    flags.push("hr_mismatch");
  }

  const parts: string[] = [];
  if (estimatedHr != null) {
    parts.push(`Cribado: FC estimada ~${estimatedHr} lpm`);
  } else {
    parts.push("Cribado: trazado registrado");
  }
  if (flags.length) {
    parts.push(flags.map(flagLabel).join("; "));
  } else {
    parts.push(quality === "good" ? "ritmo aparente regular" : "calidad aceptable");
  }

  return {
    quality,
    estimatedHr,
    peakCount: peaks.length,
    flags,
    summaryEs: parts.join(" · "),
    disclaimerEs,
  };
}

export function ecgFlagsToCsv(flags: EcgScreenFlag[]): string {
  return flags.join(",");
}

export function parseEcgFlagsCsv(raw?: string | null): EcgScreenFlag[] {
  if (!raw?.trim()) return [];
  const allowed = new Set<string>([
    "poor_signal",
    "bradycardia",
    "tachycardia",
    "irregular",
    "possible_af",
    "hr_mismatch",
  ]);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is EcgScreenFlag => allowed.has(s));
}
