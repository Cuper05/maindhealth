/**
 * Lectura del tensiómetro U90B Pro (Bluetooth LE) en 127.0.0.1:3931.
 * Única fuente de presión arterial del kiosco — no usa el monitor Ethernet.
 */

const BRIDGE_URL = "http://127.0.0.1:3931";

export type StationBpSample = {
  systolic: number;
  diastolic: number;
  heartRate?: number;
};

export async function confirmStationBpDone() {
  try {
    await fetch(`${BRIDGE_URL}/continue`, { method: "POST" });
  } catch {
    /* el POST /read sigue esperando */
  }
}

export async function readStationBp(
  onProgress?: (msg: string) => void,
): Promise<StationBpSample> {
  onProgress?.(
    "Encienda el U90B Pro, introduzca el brazo en el túnel y pulse START. Al ver el número, toque Ya vi el resultado.",
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
        /* el POST /read sigue en curso */
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
      systolicPressure?: number;
      diastolicPressure?: number;
      heartRate?: number;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          "Sin lectura de presión. Pulse START en el U90B Pro, espere el número y toque Ya vi el resultado.",
      );
    }
    const systolic = Number(data.systolicPressure);
    const diastolic = Number(data.diastolicPressure);
    const heartRate = Number(data.heartRate);
    // Rangos de aceptación (sin cambio respecto al BP-700 / monitor).
    if (
      !(
        systolic >= 80 &&
        systolic <= 230 &&
        diastolic >= 40 &&
        diastolic <= 140 &&
        systolic > diastolic
      )
    ) {
      throw new Error(
        "La lectura de presión no es confiable. Ajuste el brazo en el túnel y repita.",
      );
    }
    onProgress?.(
      `Listo: ${systolic}/${diastolic} mmHg${Number.isFinite(heartRate) ? ` · FC ${heartRate}` : ""}`,
    );
    return {
      systolic,
      diastolic,
      heartRate: heartRate >= 40 && heartRate <= 180 ? heartRate : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || /aborted/i.test(msg)) {
      throw new Error(
        "La presión tardó demasiado. Pulse START en el U90B Pro y toque Ya vi el resultado cuando aparezca el número.",
      );
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3931. Los bridges deben estar en fondo (station-bridges) con Python+bleak. Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearInterval(poll);
    clearTimeout(timer);
  }
}
