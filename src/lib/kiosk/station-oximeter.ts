/**
 * Lectura CMS50D+ desde el servicio local de estación (127.0.0.1:3927).
 * Solo acepta lecturas estables (el bridge espera varias muestras coherentes).
 */

const BRIDGE_URL = "http://127.0.0.1:3927";

export type StationOximeterSample = {
  spo2: number;
  hr: number;
};

export async function readStationOximeter(
  onProgress?: (msg: string) => void,
): Promise<StationOximeterSample> {
  onProgress?.("Contactando servicio local del oxímetro…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 70000);
  try {
    onProgress?.(
      "Espere con el dedo puesto: guardamos cuando SpO₂ se estabilice unos segundos.",
    );
    const res = await fetch(`${BRIDGE_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      oxygenSaturation?: number;
      heartRate?: number;
      error?: string;
      bytes?: number;
      code?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          `Sin lectura estable del oxímetro${typeof data.bytes === "number" ? ` (${data.bytes} bytes)` : ""}. Encienda el aparato, coloque el dedo bien y espere.`,
      );
    }
    const spo2 = Number(data.oxygenSaturation);
    const hr = Number(data.heartRate);
    if (!(spo2 >= 90 && spo2 <= 100 && hr >= 40 && hr <= 180)) {
      throw new Error(
        "La lectura no es confiable. Ajuste el dedo (uñas largas: de costado) y vuelva a leer.",
      );
    }
    onProgress?.(`Lectura estable: SpO₂ ${spo2}% · FC ${hr}`);
    return { spo2, hr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || /aborted/i.test(msg)) {
      throw new Error(
        "La lectura tardó demasiado. Deje el dedo quieto 10–15 s y pulse Leer oxímetro una sola vez.",
      );
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3927. Los bridges deben estar en fondo (station-bridges). Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
