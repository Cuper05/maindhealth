/**
 * Termómetro Beurer FT95 por Bluetooth (127.0.0.1:3933).
 * Solo transmite unos 30 s después de medir en la frente con SCAN.
 */

const BRIDGE_URL = "http://127.0.0.1:3933";

export type StationThermometerSample = {
  temperature?: number;
  connected: boolean;
};

export async function probeStationThermometer(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(res.ok && data.ok);
  } catch {
    return false;
  }
}

export async function readStationThermometer(
  onProgress?: (msg: string) => void,
): Promise<StationThermometerSample> {
  onProgress?.("Encienda el termómetro, colóquelo en la frente y pulse START…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 32000);
  const poll = setInterval(() => {
    void (async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/progress`, { cache: "no-store" });
        const data = (await res.json()) as { message?: string };
        if (data.message) onProgress?.(data.message);
      } catch {
        /* POST /read sigue en curso */
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
      error?: string;
      connected?: boolean;
      temperature?: number | null;
    };
    if (!res.ok || !data.ok || data.temperature == null) {
      throw new Error(data.error || "Sin lectura del termómetro FT95.");
    }
    return {
      connected: Boolean(data.connected),
      temperature: data.temperature,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || /aborted/i.test(msg)) {
      throw new Error(
        "La temperatura tardó demasiado. Encienda el termómetro, colóquelo en la frente, pulse START y deje parpadear el Bluetooth.",
      );
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3933. Arranque station-bridges. Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearInterval(poll);
    clearTimeout(timer);
  }
}
