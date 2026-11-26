/**
 * Lectura del MD100C_P (BLE) desde 127.0.0.1:3928.
 * Solo trazado/onda. La FC (lpm) la da el oxímetro, no este bridge.
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
    const wave = Array.isArray(data.wave) ? data.wave.map((n) => Number(n)) : [];
    onProgress?.({ message: rhythm, wave });
    return {
      rhythm,
      wavePoints: data.wavePoints ?? wave.length,
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

/** Trazado sintético (estilo data[3] ~60–100) para demo / simulación. */
export function buildSyntheticEcgWave(points = 90): number[] {
  const samples: number[] = [];
  for (let i = 0; i < points; i++) {
    const base = 70 + Math.sin(i / 3.2) * 22;
    const notch = Math.sin(i / 1.1) * 6;
    samples.push(Math.round(base + notch));
  }
  return samples;
}
