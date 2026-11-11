/**
 * Cliente del bridge K3 Pro (USB serial COM8) → 127.0.0.1:3933
 * Solo toma la última temperatura corporal (T body).
 */

export type ThermometerSample = {
  temperature: number;
  device: string;
  port?: string;
};

const DEFAULT_BASE = "http://127.0.0.1:3933";

function bridgeBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_THERMOMETER_BRIDGE_URL?.trim();
  return (fromEnv || DEFAULT_BASE).replace(/\/$/, "");
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${bridgeBase()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function getThermometerHealth(): Promise<{
  ok: boolean;
  busy?: boolean;
  port?: string;
  message?: string;
}> {
  try {
    const { ok, data } = await fetchJson<{
      ok?: boolean;
      port?: string;
      message?: string;
      phase?: string;
    }>("/health");
    return {
      ok: ok && data.ok !== false,
      port: data.port,
      message: data.message,
    };
  } catch {
    return { ok: false };
  }
}

type ProgressPayload = {
  phase?: string;
  message?: string;
  temperature?: number | null;
};

/**
 * Lee temperatura corporal del K3 Pro.
 * POST /read bloquea hasta el resultado; se consulta /progress en paralelo.
 */
export async function readStationThermometer(
  onStatus?: (message: string) => void,
): Promise<ThermometerSample> {
  const health = await getThermometerHealth();
  if (!health.ok) {
    throw new Error(
      "El servicio del termómetro K3 Pro no responde. En la PC de la estación ejecute tools\\station-bridges\\iniciar-puentes.bat",
    );
  }

  onStatus?.(
    "Acérquese al K3 Pro: frente a 5–10 cm hasta el pitido (modo corporal)…",
  );

  let stopPoll = false;
  const poll = (async () => {
    while (!stopPoll) {
      try {
        const { data } = await fetchJson<ProgressPayload>("/progress");
        if (data.message) onStatus?.(data.message);
        if (typeof data.temperature === "number" && Number.isFinite(data.temperature)) {
          onStatus?.(`${data.temperature.toFixed(1)} °C`);
        }
      } catch {
        /* ignore transient */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  })();

  try {
    const { ok, status, data } = await fetchJson<{
      ok?: boolean;
      temperature?: number;
      error?: string;
      device?: string;
      port?: string;
    }>("/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (!ok || data.ok === false || typeof data.temperature !== "number") {
      throw new Error(
        data.error ||
          (status === 409
            ? "Ya hay una lectura de temperatura en curso."
            : "Sin lectura del K3 Pro. Enciéndalo, modo corporal, frente a 5–10 cm hasta el pitido."),
      );
    }

    onStatus?.(`${data.temperature.toFixed(1)} °C`);
    return {
      temperature: data.temperature,
      device: data.device || "k3pro",
      port: data.port,
    };
  } finally {
    stopPoll = true;
    await poll.catch(() => undefined);
  }
}
