/**
 * Lectura del MD100C_P (BLE) desde 127.0.0.1:3928.
 * Flujo: conectar → dedo ~30 s → «Ya terminó» → FC + etiqueta clínica + onda en vivo.
 */

const BRIDGE_URL = "http://127.0.0.1:3928";

export type StationEcgSample = {
  heartRate: number;
  rhythm: string;
  quality?: string;
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
      "Encienda el MD100C_P, dedos en las placas ~30 s. Cuando vea la FC en el aparato, toque Ya terminó.",
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
        onProgress?.({
          message: data.message,
          wave: Array.isArray(data.wave) ? data.wave.map((n) => Number(n)) : [],
          phase: data.phase,
        });
      } catch {
        /* ignore */
      }
    })();
  }, 200);

  try {
    const res = await fetch(`${BRIDGE_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      heartRate?: number;
      rhythm?: string;
      quality?: string;
      source?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          "Sin lectura del MD100C_P. Mantenga el dedo ~30 s y toque Ya terminó.",
      );
    }
    const heartRate = Number(data.heartRate);
    const rhythm = typeof data.rhythm === "string" ? data.rhythm.trim() : "";
    if (!(heartRate >= 30 && heartRate <= 250) || !rhythm) {
      throw new Error(
        "Lectura inválida del MD100C_P. Reintente con el dedo firme en el sensor.",
      );
    }
    onProgress?.({ message: `${rhythm} · FC ${heartRate} lpm` });
    return {
      heartRate,
      rhythm,
      quality: data.quality,
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

/** Trazado sintético PQRST para demo / simulación (no clínico). */
export function buildSyntheticEcgWave(points = 280, bpm = 72): number[] {
  const samples: number[] = [];
  const samplesPerBeat = Math.max(40, Math.round((60 / bpm) * 90));
  for (let i = 0; i < points; i++) {
    const t = (i % samplesPerBeat) / samplesPerBeat;
    let y = 0.5;
    // P
    if (t > 0.08 && t < 0.16) {
      const u = (t - 0.08) / 0.08;
      y += 0.12 * Math.sin(Math.PI * u);
    }
    // Q
    if (t > 0.28 && t < 0.32) {
      const u = (t - 0.28) / 0.04;
      y -= 0.15 * u;
    }
    // R
    if (t >= 0.32 && t < 0.38) {
      const u = (t - 0.32) / 0.06;
      y += u < 0.5 ? -0.15 + u * 2.2 : 0.95 - (u - 0.5) * 2.4;
    }
    // S
    if (t >= 0.38 && t < 0.44) {
      const u = (t - 0.38) / 0.06;
      y += -0.25 + u * 0.35;
    }
    // T
    if (t > 0.52 && t < 0.72) {
      const u = (t - 0.52) / 0.2;
      y += 0.22 * Math.sin(Math.PI * u);
    }
    samples.push(Math.round(40 + y * 80 + Math.sin(i / 17) * 1.5));
  }
  return samples;
}
