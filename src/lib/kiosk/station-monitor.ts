/**
 * Monitor multiparámetro por Ethernet (127.0.0.1:3932).
 * Ya no se usa para SpO₂ ni presión arterial del kiosco.
 * SpO₂ = CMS50D+ (:3927). TA = U90B Pro BLE (:3931).
 * Solo queda temperatura de respaldo por si se necesita.
 */

const BRIDGE_URL = "http://127.0.0.1:3932";

export type StationMonitorKind = "temp";

export type StationMonitorSample = {
  temperature?: number;
  connected: boolean;
};

export async function probeStationMonitor(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { cache: "no-store" });
    const data = (await res.json()) as { connected?: boolean; ok?: boolean };
    return Boolean(res.ok && data.ok);
  } catch {
    return false;
  }
}

export async function readStationMonitor(
  kind: StationMonitorKind,
  onProgress?: (msg: string) => void,
): Promise<StationMonitorSample> {
  if (kind !== "temp") {
    throw new Error(
      "SpO₂ y presión no usan el monitor Ethernet. Oxígeno = CMS50D+ (:3927). Presión = U90B (:3931).",
    );
  }

  onProgress?.("Contactando el monitor por Ethernet…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 95000);
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
    const res = await fetch(`${BRIDGE_URL}/read?kind=temp`, {
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
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Sin lectura del monitor Ethernet.");
    }
    return {
      connected: Boolean(data.connected),
      temperature: data.temperature ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || /aborted/i.test(msg)) {
      throw new Error("La temperatura tardó demasiado. Mantenga la sonda en la axila.");
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3932. Arranque station-bridges y ejecute 1-configurar-ethernet.bat. Si Edge pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearInterval(poll);
    clearTimeout(timer);
  }
}
