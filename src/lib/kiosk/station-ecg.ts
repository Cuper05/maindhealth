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
};

export type StationEcgProgress = {
  message?: string;
  wave?: number[];
  phase?: string;
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
        };
        const raw = Array.isArray(data.wave) ? data.wave.map((n) => Number(n)) : [];
        onProgress?.({
          message: data.message,
          wave: prepareWaveForDisplay(raw),
          phase: data.phase,
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
    onProgress?.({ message: rhythm, wave });
    return {
      rhythm,
      wavePoints: data.wavePoints ?? raw.length,
      wave,
      source: data.source ?? "md100c_p",
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

/** Estimación rápida de FC por picos (para pacing del sinusal de display). */
export function estimateHrForDisplay(
  samples: number[],
  sampleRate = 60,
): number | null {
  const pts = samples.filter((n) => Number.isFinite(n));
  if (pts.length < Math.max(40, sampleRate)) return null;

  const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
  const centered = pts.map((v) => v - mean);
  const positives = centered.filter((v) => v > 0);
  if (positives.length < 8) return null;
  positives.sort((a, b) => a - b);
  const thr = positives[Math.floor(positives.length * 0.85)]! * 0.55;
  const minDist = Math.max(8, Math.round(sampleRate * 0.32));

  const peaks: number[] = [];
  for (let i = 2; i < centered.length - 2; i++) {
    const v = centered[i]!;
    if (v < thr) continue;
    if (
      v >= centered[i - 1]! &&
      v >= centered[i + 1]! &&
      v >= centered[i - 2]! &&
      v >= centered[i + 2]!
    ) {
      if (peaks.every((p) => Math.abs(p - i) >= minDist)) peaks.push(i);
    }
  }
  if (peaks.length < 3) return null;
  const rrs: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    rrs.push((peaks[i]! - peaks[i - 1]!) / sampleRate);
  }
  rrs.sort((a, b) => a - b);
  const med = rrs[Math.floor(rrs.length / 2)]!;
  if (!(med > 0.28 && med < 2.0)) return null;
  return Math.round(60 / med);
}

/**
 * Con los datos recibidos: misma longitud, morfología de ritmo sinusal
 * paced por la FC estimada del trazado (o 72 lpm).
 */
export function buildDisplaySinusFromSamples(
  raw: number[],
  opts?: { sampleRateHz?: number; fallbackBpm?: number },
): number[] {
  const sampleRate = opts?.sampleRateHz ?? 60;
  const pts = prepareWaveForDisplay(raw);
  if (pts.length === 0) return [];
  const bpm =
    estimateHrForDisplay(pts, sampleRate) ?? opts?.fallbackBpm ?? 72;
  return buildSinusRhythmWave(pts.length, bpm, sampleRate);
}

/** Alias demo / simulación kiosko. */
export function buildSyntheticEcgWave(points = 480, bpm = 72): number[] {
  return buildSinusRhythmWave(points, bpm, 60);
}
