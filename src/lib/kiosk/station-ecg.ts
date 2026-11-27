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

/**
 * Demo: onda tipo monitor de signos vitales (P–QRS–T suave / sinusoidal).
 * Sin picos triangulares; solo senos. No clínico.
 */
export function buildSyntheticEcgWave(points = 480, bpm = 72): number[] {
  const sampleRate = 60;
  const samplesPerBeat = Math.max(24, Math.round((60 / bpm) * sampleRate));
  const raw: number[] = [];
  for (let i = 0; i < points; i++) {
    const phase = (i % samplesPerBeat) / samplesPerBeat;
    let y = 512 + 5 * Math.sin(i / 48);

    // P (seno suave)
    if (phase > 0.08 && phase < 0.18) {
      y += 32 * Math.sin(((phase - 0.08) / 0.1) * Math.PI);
    }
    // Q (valle seno)
    if (phase > 0.26 && phase < 0.3) {
      y -= 38 * Math.sin(((phase - 0.26) / 0.04) * Math.PI);
    }
    // R (seno alto — aspecto monitor, no diente de sierra)
    if (phase >= 0.3 && phase < 0.38) {
      y += 205 * Math.sin(((phase - 0.3) / 0.08) * Math.PI);
    }
    // S (valle seno)
    if (phase >= 0.38 && phase < 0.45) {
      y -= 58 * Math.sin(((phase - 0.38) / 0.07) * Math.PI);
    }
    // T (seno)
    if (phase > 0.52 && phase < 0.74) {
      y += 58 * Math.sin(((phase - 0.52) / 0.22) * Math.PI);
    }

    raw.push(Math.round(y));
  }
  return raw;
}
