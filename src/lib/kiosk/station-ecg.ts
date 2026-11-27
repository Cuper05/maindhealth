/**
 * Lectura del MD100C_P (BLE) desde 127.0.0.1:3928.
 * Onda ChoiceMMed: 0x01 + 5×[LO,HI,FLAG] → uint16. FC = oxímetro.
 */

const BRIDGE_URL = "http://127.0.0.1:3928";

export type StationEcgSample = {
  rhythm: string;
  wavePoints?: number;
  wave?: number[];
  source?: string;
  sampleRateHz?: number;
};

export type StationEcgProgress = {
  message?: string;
  wave?: number[];
  phase?: string;
  sampleRateHz?: number;
};

export async function confirmStationEcgDone() {
  try {
    await fetch(`${BRIDGE_URL}/continue`, { method: "POST" });
  } catch {
    /* el POST /read sigue esperando */
  }
}

export async function readStationEcg(
  onProgress?: (progress: StationEcgProgress) => void,
): Promise<StationEcgSample> {
  onProgress?.({
    message:
      "Encienda el MD100C_P, dedos en las placas ~30 s. Cuando vea la onda, toque Ya terminó.",
    wave: [],
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 160000);
  const poll = setInterval(() => {
    void (async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/progress`, { cache: "no-store" });
        const data = (await res.json()) as {
          message?: string;
          wave?: number[];
          phase?: string;
          sampleRateHz?: number;
        };
        const raw = Array.isArray(data.wave) ? data.wave.map((n) => Number(n)) : [];
        const rate =
          typeof data.sampleRateHz === "number" &&
          Number.isFinite(data.sampleRateHz) &&
          data.sampleRateHz > 20 &&
          data.sampleRateHz < 200
            ? data.sampleRateHz
            : undefined;
        onProgress?.({
          message: data.message,
          wave: prepareWaveForDisplay(raw),
          phase: data.phase,
          sampleRateHz: rate,
        });
      } catch {
        /* ignore */
      }
    })();
  }, 160);

  try {
    const res = await fetch(`${BRIDGE_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      rhythm?: string;
      wavePoints?: number;
      wave?: number[];
      source?: string;
      error?: string;
      sampleRateHz?: number;
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          "Sin lectura del MD100C_P. Mantenga el dedo ~30 s y toque Ya terminó.",
      );
    }
    const rhythm =
      typeof data.rhythm === "string" && data.rhythm.trim()
        ? data.rhythm.trim()
        : "Trazado ECG registrado (MD100C_P)";
    const raw = Array.isArray(data.wave) ? data.wave.map((n) => Number(n)) : [];
    const wave = prepareWaveForDisplay(raw);
    const rate =
      typeof data.sampleRateHz === "number" &&
      Number.isFinite(data.sampleRateHz) &&
      data.sampleRateHz > 20 &&
      data.sampleRateHz < 200
        ? data.sampleRateHz
        : undefined;
    onProgress?.({ message: rhythm, wave, sampleRateHz: rate });
    return {
      rhythm,
      wavePoints: data.wavePoints ?? raw.length,
      wave,
      source: data.source ?? "md100c_p",
      sampleRateHz: rate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || /aborted/i.test(msg)) {
      throw new Error(
        "El MD100C_P tardó demasiado. Enciéndalo, coloque el dedo y toque Ya terminó.",
      );
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3928. Instale Python+bleak (ecg-bridge) y reinicie station-bridges. Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearInterval(poll);
    clearTimeout(timer);
  }
}

/**
 * Quita el canal constante ~34 intercalado (MD100C_P).
 * Si no, el trazo se ve triangular en lugar de onda biológica.
 */
export function stripProtocolConstant(raw: number[]): number[] {
  const pts = raw.filter((n) => Number.isFinite(n));
  if (pts.length < 4) return pts;

  const even = pts.filter((_, i) => i % 2 === 0);
  const odd = pts.filter((_, i) => i % 2 === 1);

  const mostlyConstant = (xs: number[]): { ok: boolean; val: number } => {
    if (!xs.length) return { ok: false, val: 0 };
    const counts = new Map<number, number>();
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
    let best = xs[0]!;
    let n = 0;
    for (const [v, c] of counts) {
      if (c > n) {
        best = v;
        n = c;
      }
    }
    return { ok: n >= Math.max(2, Math.floor(xs.length * 0.65)), val: best };
  };

  const e = mostlyConstant(even);
  const o = mostlyConstant(odd);
  if (e.ok && !o.ok && e.val >= 20 && e.val <= 45) return odd;
  if (o.ok && !e.ok && o.val >= 20 && o.val <= 45) return even;

  const counts = new Map<number, number>();
  for (const x of pts) counts.set(x, (counts.get(x) ?? 0) + 1);
  let mode = pts[0]!;
  let modeN = 0;
  for (const [v, c] of counts) {
    if (c > modeN) {
      mode = v;
      modeN = c;
    }
  }
  if (modeN >= Math.max(3, Math.floor(pts.length * 0.35)) && mode >= 20 && mode <= 45) {
    const cleaned = pts.filter((p) => p !== mode);
    if (cleaned.length >= 2) return cleaned;
  }
  return pts;
}

/**
 * Siempre la misma tubería de display: strip ~34 y muestras reales.
 * (Antes, con <40 pts se interpolaba con coseno y al llegar a 40
 * cambiaba de golpe a crudo → “otra gráfica” a los ~4 s.)
 */
export function prepareWaveForDisplay(raw: number[], maxPoints = 600): number[] {
  const pts = stripProtocolConstant(raw.filter((n) => Number.isFinite(n)));
  if (pts.length === 0) return [];
  return pts.length > maxPoints ? pts.slice(-maxPoints) : pts;
}

/** Semi-seno positivo en [center ± halfWidth]. */
function sineLobe(
  tSec: number,
  center: number,
  halfWidth: number,
  amp: number,
): number {
  const d = Math.abs(tSec - center);
  if (d >= halfWidth || halfWidth <= 0) return 0;
  return amp * Math.sin((1 - d / halfWidth) * (Math.PI / 2)) ** 2;
}

/**
 * Ritmo sinusal normal (P–QRS–T) como en papel ECG educativo.
 * Intervalos orientativos: PR 0.12–0.20 s, QRS ~0.08 s, QT ~0.36–0.40 s.
 * Solo para visualización / demo — no clínico.
 */
export function buildSinusRhythmWave(
  points = 480,
  bpm = 72,
  sampleRate = 60,
): number[] {
  const hr = Math.min(140, Math.max(40, Math.round(bpm)));
  const samplesPerBeat = Math.max(
    20,
    Math.round((60 / hr) * sampleRate),
  );
  const rr = samplesPerBeat / sampleRate; // segundos por latido

  // Anclas en segundos dentro del ciclo (R cerca de 1/3 del RR).
  const tR = Math.min(0.28, rr * 0.32);
  const tP = tR - 0.16; // PR ~0.16 s
  const tQ = tR - 0.025;
  const tS = tR + 0.03;
  const tT = tR + 0.22; // QT ~0.36–0.40

  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = ((i % samplesPerBeat) / sampleRate);
    let y = 512 + 2.5 * Math.sin(i / 55);

    // P redondeada
    y += sineLobe(t, tP, 0.045, 36);
    // Q pequeña
    y -= sineLobe(t, tQ, 0.018, 42);
    // R alta (pico sinusal)
    y += sineLobe(t, tR, 0.028, 220);
    // S
    y -= sineLobe(t, tS, 0.024, 62);
    // T redondeada
    y += sineLobe(t, tT, 0.09, 64);

    out.push(Math.round(y));
  }
  return out;
}

export type DisplayPeak = { index: number; amp: number };

/** Picos R reales del trazado (índice + amplitud centrada). */
export function findRealRPeaks(
  samples: number[],
  sampleRate = 60,
): { peaks: DisplayPeak[]; baseline: number } {
  const pts = samples.filter((n) => Number.isFinite(n));
  if (pts.length < Math.max(40, sampleRate * 0.6)) {
    return { peaks: [], baseline: pts.length ? pts[0]! : 512 };
  }

  const baseline = pts.reduce((a, b) => a + b, 0) / pts.length;
  const centered = pts.map((v) => v - baseline);
  const positives = centered.filter((v) => v > 0);
  if (positives.length < 8) return { peaks: [], baseline };

  const sorted = [...positives].sort((a, b) => a - b);
  const thr = sorted[Math.floor(sorted.length * 0.85)]! * 0.55;
  const minDist = Math.max(8, Math.round(sampleRate * 0.32));

  const candidates: DisplayPeak[] = [];
  for (let i = 2; i < centered.length - 2; i++) {
    const v = centered[i]!;
    if (v < thr) continue;
    if (
      v >= centered[i - 1]! &&
      v >= centered[i + 1]! &&
      v >= centered[i - 2]! &&
      v >= centered[i + 2]!
    ) {
      candidates.push({ index: i, amp: v });
    }
  }
  candidates.sort((a, b) => b.amp - a.amp);
  const chosen: DisplayPeak[] = [];
  for (const c of candidates) {
    if (chosen.every((p) => Math.abs(p.index - c.index) >= minDist)) {
      chosen.push(c);
    }
  }
  chosen.sort((a, b) => a.index - b.index);
  return { peaks: chosen, baseline };
}

/** Estimación rápida de FC por picos reales. */
export function estimateHrForDisplay(
  samples: number[],
  sampleRate = 60,
): number | null {
  const { peaks } = findRealRPeaks(samples, sampleRate);
  if (peaks.length < 3) return null;
  const rrs: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    rrs.push((peaks[i]!.index - peaks[i - 1]!.index) / sampleRate);
  }
  rrs.sort((a, b) => a - b);
  const med = rrs[Math.floor(rrs.length / 2)]!;
  if (!(med > 0.28 && med < 2.0)) return null;
  return Math.round(60 / med);
}

/** Un latido P–QRS–T centrado en tR (segundos), escalado por ampScale. */
function paintBeatAt(
  out: number[],
  sampleRate: number,
  tR: number,
  ampScale: number,
) {
  const n = out.length;
  const tP = tR - 0.16;
  const tQ = tR - 0.025;
  const tS = tR + 0.03;
  const tT = tR + 0.22;
  const i0 = Math.max(0, Math.floor((tR - 0.28) * sampleRate));
  const i1 = Math.min(n - 1, Math.ceil((tR + 0.38) * sampleRate));
  for (let i = i0; i <= i1; i++) {
    const t = i / sampleRate;
    let dy = 0;
    dy += sineLobe(t, tP, 0.045, 36 * ampScale);
    dy -= sineLobe(t, tQ, 0.018, 42 * ampScale);
    dy += sineLobe(t, tR, 0.028, 220 * ampScale);
    dy -= sineLobe(t, tS, 0.024, 62 * ampScale);
    dy += sineLobe(t, tT, 0.09, 64 * ampScale);
    out[i] = (out[i] ?? 0) + dy;
  }
}

/**
 * Simulación visual de ritmo sinusal usando los datos reales del ECG:
 * - Línea base = media del trazado real
 * - Cada R detectado en la onda real coloca un latido P–QRS–T
 * - La altura del R sigue la amplitud real de ese pico
 * - Los intervalos RR son los reales (si el ritmo es irregular, se ve)
 * Fallback: sinusal regular a FC estimada / 72 si hay pocos picos.
 */
export function buildDisplaySinusFromSamples(
  raw: number[],
  opts?: { sampleRateHz?: number; fallbackBpm?: number },
): number[] {
  const sampleRate = opts?.sampleRateHz ?? 60;
  const pts = prepareWaveForDisplay(raw);
  if (pts.length === 0) return [];

  const { peaks, baseline } = findRealRPeaks(pts, sampleRate);
  const refAmp = 220; // amplitud R del template

  if (peaks.length >= 2) {
    const out = Array.from({ length: pts.length }, () => baseline);
    const medianAmp = (() => {
      const amps = peaks.map((p) => p.amp).sort((a, b) => a - b);
      return amps[Math.floor(amps.length / 2)]! || refAmp;
    })();

    for (const peak of peaks) {
      const ampScale = Math.min(
        1.6,
        Math.max(0.45, peak.amp / Math.max(medianAmp, 1)),
      );
      const tR = peak.index / sampleRate;
      paintBeatAt(out, sampleRate, tR, ampScale);
    }
    return out.map((v) => Math.round(v));
  }

  // Pocos picos aún: pacing regular con FC de los datos (o fallback).
  const bpm =
    estimateHrForDisplay(pts, sampleRate) ?? opts?.fallbackBpm ?? 72;
  const synth = buildSinusRhythmWave(pts.length, bpm, sampleRate);
  // Re-centra a la baseline real para que no “salte” de escala.
  const synthMean =
    synth.reduce((a, b) => a + b, 0) / Math.max(1, synth.length);
  const shift = baseline - synthMean;
  return synth.map((v) => Math.round(v + shift));
}

/** Alias demo / simulación kiosko. */
export function buildSyntheticEcgWave(points = 480, bpm = 72): number[] {
  return buildSinusRhythmWave(points, bpm, 60);
}
