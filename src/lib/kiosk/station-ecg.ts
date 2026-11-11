/**
 * Lectura del MD100C_P (BLE) desde 127.0.0.1:3928.
 * Flujo: conectar → dedo ~30 s → «Ya terminó» → FC + etiqueta clínica.
 */

const BRIDGE_URL = "http://127.0.0.1:3928";

export type StationEcgSample = {
  heartRate: number;
  rhythm: string;
  quality?: string;
  source?: string;
};

export async function confirmStationEcgDone() {
  try {
    await fetch(`${BRIDGE_URL}/continue`, { method: "POST" });
  } catch {
    /* el POST /read sigue esperando */
  }
}

export async function readStationEcg(
  onProgress?: (msg: string) => void,
): Promise<StationEcgSample> {
  onProgress?.(
    "Encienda el MD100C_P, dedos en las placas ~30 s. Cuando vea la FC en el aparato, toque Ya terminó.",
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 160000);
  const poll = setInterval(() => {
    void (async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/progress`, { cache: "no-store" });
        const data = (await res.json()) as { message?: string };
        if (data.message) onProgress?.(data.message);
      } catch {
        /* ignore */
      }
    })();
  }, 800);

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
    onProgress?.(`${rhythm} · FC ${heartRate} lpm`);
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
