/**
 * Lectura CMS50D+ desde el servicio local de estación (127.0.0.1:3927).
 * Mismo camino que ya funciona en la ficha del dispositivo.
 */

const BRIDGE_URL = "http://127.0.0.1:3927";

export type StationOximeterSample = {
  spo2: number;
  hr: number;
};

export async function bridgeOximeterHealthy(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function readStationOximeter(
  onProgress?: (msg: string) => void,
): Promise<StationOximeterSample> {
  onProgress?.("Contactando servicio local del oxímetro…");

  const healthy = await bridgeOximeterHealthy();
  if (!healthy) {
    throw new Error(
      "No está el servicio local (127.0.0.1:3927). Abre iniciar-servicio-oximetro.bat y déjalo abierto.",
    );
  }

  onProgress?.("Leyendo oxímetro… mantén el dedo firme");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
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
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          `Sin lectura del oxímetro${typeof data.bytes === "number" ? ` (${data.bytes} bytes)` : ""}. Enciende el aparato y pon el dedo.`,
      );
    }
    const spo2 = Number(data.oxygenSaturation);
    const hr = Number(data.heartRate);
    if (!(spo2 >= 70 && spo2 <= 100 && hr >= 30 && hr <= 250)) {
      throw new Error("Lectura inválida del oxímetro. Reintenta con el dedo firme.");
    }
    onProgress?.(`SpO₂ ${spo2}% · FC ${hr}`);
    return { spo2, hr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|abort/i.test(msg)) {
      throw new Error(
        "Chrome no pudo hablar con el servicio local. Abre iniciar-servicio-oximetro.bat y, si pide permiso de red local, elige Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
