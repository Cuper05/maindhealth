/**
 * Lectura del baumanómetro USB (CP2110) en 127.0.0.1:3931.
 * El aparato no mide con el USB conectado: desconectar → medir → reconectar.
 */

const BRIDGE_URL = "http://127.0.0.1:3931";

export type StationBpSample = {
  systolic: number;
  diastolic: number;
  heartRate?: number;
};

export async function readStationBp(
  onProgress?: (msg: string) => void,
): Promise<StationBpSample> {
  onProgress?.(
    "Desconecte el USB, mida en el aparato y, al ver el resultado, reconecte el cable…",
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
          "Sin lectura de presión. Desconecte el USB, mida, reconecte y toque Leer otra vez.",
      );
    }
    const systolic = Number(data.systolicPressure);
    const diastolic = Number(data.diastolicPressure);
    const heartRate = Number(data.heartRate);
    if (!(systolic >= 80 && systolic <= 230 && diastolic >= 40 && diastolic <= 140 && systolic > diastolic)) {
      throw new Error("La lectura de presión no es confiable. Ajuste el brazalete y repita.");
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
        "La presión tardó demasiado. Mida sin USB, reconecte el cable y pulse Leer otra vez.",
      );
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3931. Los bridges deben estar en fondo (station-bridges). Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearInterval(poll);
    clearTimeout(timer);
  }
}
