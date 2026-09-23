/**
 * Monitor multiparámetro por Ethernet (127.0.0.1:3932).
 * TA, SpO₂ y temperatura salen del mismo aparato.
 */

const BRIDGE_URL = "http://127.0.0.1:3932";

export type StationMonitorKind = "nibp" | "spo2" | "temp";

export type StationMonitorSample = {
  spo2?: number;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
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
  onProgress?.("Contactando el monitor por Ethernet…");

  const timeouts: Record<StationMonitorKind, number> = {
    nibp: 155000,
    spo2: 75000,
    temp: 95000,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeouts[kind]);
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
    const res = await fetch(`${BRIDGE_URL}/read?kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      connected?: boolean;
      spo2?: number | null;
      heartRate?: number | null;
      systolicPressure?: number | null;
      diastolicPressure?: number | null;
      temperature?: number | null;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Sin lectura del monitor Ethernet.");
    }
    return {
      connected: Boolean(data.connected),
      spo2: data.spo2 ?? undefined,
      heartRate: data.heartRate ?? undefined,
      systolic: data.systolicPressure ?? undefined,
      diastolic: data.diastolicPressure ?? undefined,
      temperature: data.temperature ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || /aborted/i.test(msg)) {
      throw new Error(
        kind === "nibp"
          ? "La presión tardó demasiado. Pulse NIBP en el monitor y espere el número."
          : kind === "spo2"
            ? "SpO₂ tardó demasiado. Deje el dedo en el sensor del monitor."
            : "La temperatura tardó demasiado. Mantenga la sonda en la axila.",
      );
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
