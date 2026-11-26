/**
 * Lectura del MD100C_P (BLE) desde 127.0.0.1:3928.
 * Solo trazado/onda (data[3] / trama 0x01). La FC (lpm) la da el oxímetro.
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
          wave: interpolateWave(raw),
          phase: data.phase,
        });
      } catch {
        /* ignore */
      }
    })();
  }, 180);

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
    const wave = interpolateWave(raw);
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
 * Interpolación coseno entre puntos crudos (data[3] / trama 0x01 de ecg.py).
 * Rellena huecos para que el trazado se vea como onda sinusoidal continua.
 */
export function interpolateWave(raw: number[], outPoints = 180): number[] {
  const pts = raw.filter((n) => Number.isFinite(n));
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: Math.min(outPoints, 24) }, () => pts[0]!);

  const target = Math.max(pts.length, Math.min(outPoints, pts.length * 6));
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const t = (i / (target - 1)) * (pts.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, pts.length - 1);
    const frac = t - i0;
    // Cosine ease = tramo suave tipo seno entre muestras BLE.
    const mu = (1 - Math.cos(frac * Math.PI)) / 2;
    out.push(pts[i0]! * (1 - mu) + pts[i1]! * mu);
  }
  return out;
}

/** Trazado sintético (estilo data[3] ~40–180 de ecg.py) para demo. */
export function buildSyntheticEcgWave(points = 90): number[] {
  const raw: number[] = [];
  for (let i = 0; i < Math.max(12, Math.floor(points / 4)); i++) {
    const base = 70 + Math.sin(i / 1.6) * 28;
    const beat = Math.sin(i * 1.7) * 10;
    raw.push(Math.round(base + beat));
  }
  return interpolateWave(raw, points);
}
