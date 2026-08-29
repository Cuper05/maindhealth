/**
 * Lectura de ECG desde el servicio local de estación (127.0.0.1:3928).
 * Misma idea que el oxímetro en :3927. El bridge se completa al llegar el equipo USB (p. ej. PC-80B).
 */

const BRIDGE_URL = "http://127.0.0.1:3928";

export type StationEcgSample = {
  heartRate: number;
  rhythm: string;
  quality?: string;
};

export async function readStationEcg(
  onProgress?: (msg: string) => void,
): Promise<StationEcgSample> {
  onProgress?.("Contactando servicio local del ECG…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    onProgress?.("Leyendo ECG… mantenga los dedos quietos ~30 s");
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
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          "Sin lectura del ECG. Encienda el aparato, coloque los dedos y vuelva a intentar.",
      );
    }
    const heartRate = Number(data.heartRate);
    const rhythm = typeof data.rhythm === "string" ? data.rhythm.trim() : "";
    if (!(heartRate >= 30 && heartRate <= 250) || !rhythm) {
      throw new Error("Lectura inválida del ECG. Reintente manteniendo los dedos firmes.");
    }
    onProgress?.(`${rhythm} · FC ${heartRate} lpm`);
    return { heartRate, rhythm, quality: data.quality };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|abort/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3928. Los bridges deben estar en fondo (station-bridges). Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
