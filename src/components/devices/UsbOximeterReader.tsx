"use client";

import { useMemo, useState, useTransition } from "react";
import { recordUsbOximeterReading } from "@/lib/actions/usb-oximeter";
import { FormAlert } from "@/components/ui/PageHeader";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

type PatientOption = { id: number; label: string };

type SerialPortLike = {
  open: (options: {
    baudRate: number;
    bufferSize?: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
    flowControl?: string;
  }) => Promise<void>;
  close: () => Promise<void>;
  forget?: () => Promise<void>;
  setSignals?: (signals: {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
  }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

const BRIDGE_URL = "http://127.0.0.1:3927";
const SILICON_LABS_VID = 0x10c4;

/** Mismas órdenes que el puente Node que ya leyó este CMS50D+. */
const REALTIME_CMDS = [
  new Uint8Array([0x7d, 0x81, 0xa6, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  new Uint8Array([0x7d, 0x81, 0xa2, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  new Uint8Array([0x7d, 0x81, 0xa7, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  new Uint8Array([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  new Uint8Array([0x7d, 0x81, 0xa0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
];
const PING_CMD = new Uint8Array([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);
const KEEP_CMD = new Uint8Array([0x7d, 0x81, 0xaf, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseClassic5(buffer: Uint8Array) {
  const readings: { spo2: number; hr: number }[] = [];
  for (let i = 0; i < buffer.length - 4; i++) {
    const b0 = buffer[i]!;
    if ((b0 & 0x80) === 0) continue;
    const b1 = buffer[i + 1]!;
    const b2 = buffer[i + 2]!;
    const b3 = buffer[i + 3]!;
    const b4 = buffer[i + 4]!;
    if (b1 & 0x80 || b2 & 0x80 || b3 & 0x80 || b4 & 0x80) continue;
    if (b4 >= 70 && b4 <= 100 && b3 >= 30 && b3 <= 250) {
      readings.push({ spo2: b4, hr: b3 });
      i += 4;
    }
  }
  return readings;
}

/** Protocolo v7 (9 bytes, bits de sync). */
function parseV7(buffer: Uint8Array) {
  const readings: { spo2: number; hr: number }[] = [];
  for (let i = 0; i < buffer.length - 8; i++) {
    if (buffer[i]! & 0x80) continue;
    if (!(buffer[i + 1]! & 0x80)) continue;
    let syncOk = true;
    for (let j = 2; j < 9; j++) {
      if (!(buffer[i + j]! & 0x80)) {
        syncOk = false;
        break;
      }
    }
    if (!syncOk) continue;
    if (buffer[i] !== 0x01) continue;
    const high = buffer[i + 1]!;
    const pkg: number[] = [];
    for (let j = 0; j < 7; j++) {
      let b = buffer[i + 2 + j]! & 0x7f;
      if (high & (1 << j)) b |= 0x80;
      pkg.push(b);
    }
    const hr = pkg[3]!;
    const spo2 = pkg[4]!;
    if (spo2 >= 70 && spo2 <= 100 && hr >= 30 && hr <= 250 && spo2 !== 0x7f && hr !== 0xff) {
      readings.push({ spo2, hr });
    }
  }
  return readings;
}

function parseLoose(buffer: Uint8Array) {
  const readings: { spo2: number; hr: number }[] = [];
  for (let i = 0; i < buffer.length - 8; i++) {
    if (buffer[i] !== 0x01 && buffer[i] !== 0x81) continue;
    for (let a = i + 1; a < i + 8 && a < buffer.length; a++) {
      for (let b = a + 1; b < i + 9 && b < buffer.length; b++) {
        const spo2 = buffer[a]!;
        const hr = buffer[b]!;
        if (spo2 >= 85 && spo2 <= 100 && hr >= 40 && hr <= 180) {
          readings.push({ spo2, hr });
        }
      }
    }
  }
  return readings;
}

function stableOf(window: { spo2: number; hr: number }[], need = 2) {
  if (window.length < need) return null;
  const recent = window.slice(-need);
  const spo2 = recent.map((r) => r.spo2);
  const hr = recent.map((r) => r.hr);
  if (Math.max(...spo2) - Math.min(...spo2) > 3) return null;
  if (Math.max(...hr) - Math.min(...hr) > 15) return null;
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { spo2: avg(spo2), hr: avg(hr) };
}

async function ensureClosed(port: SerialPortLike) {
  try {
    await port.close();
  } catch {
    /* already closed */
  }
  await sleep(300);
}

async function openPort(port: SerialPortLike, baudRate: number) {
  await ensureClosed(port);
  try {
    await port.open({
      baudRate,
      bufferSize: 8192,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to open|open serial port|Access denied/i.test(msg)) {
      throw new Error(
        "Puerto USB ocupado. Cierra otras pestañas del oxímetro, o deja solo el servicio local (iniciar-servicio-oximetro.bat). Desconecta/reconecta USB si sigue bloqueado.",
      );
    }
    throw err;
  }
  try {
    await port.setSignals?.({ dataTerminalReady: false, requestToSend: false });
    await sleep(80);
    await port.setSignals?.({ dataTerminalReady: true, requestToSend: false });
  } catch {
    /* optional */
  }
}

async function readAtBaud(
  port: SerialPortLike,
  baudRate: number,
  maxMs: number,
  onProgress: (msg: string) => void,
): Promise<{ spo2: number; hr: number } | null> {
  await openPort(port, baudRate);
  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) {
    await ensureClosed(port);
    throw new Error("No se pudo usar el puerto USB.");
  }

  let readPromise: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;

  try {
    for (const cmd of REALTIME_CMDS) {
      await writer.write(cmd);
      await sleep(50);
    }

    const window: { spo2: number; hr: number }[] = [];
    let leftover = new Uint8Array(0);
    let bytes = 0;
    const deadline = Date.now() + maxMs;
    let lastPing = Date.now();
    let lastStatus = 0;

    while (Date.now() < deadline) {
      if (Date.now() - lastPing > 700) {
        await writer.write(PING_CMD);
        await writer.write(KEEP_CMD);
        lastPing = Date.now();
      }

      if (!readPromise) {
        readPromise = reader.read().finally(() => {
          readPromise = null;
        });
      }

      const raced = await Promise.race([
        readPromise.then((r) => ({ kind: "data" as const, r })),
        sleep(250).then(() => ({ kind: "tick" as const })),
      ]);

      if (raced.kind === "tick") {
        if (Date.now() - lastStatus > 500) {
          lastStatus = Date.now();
          const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          if (window.length > 0) {
            const last = window[window.length - 1]!;
            onProgress(`SpO2 ${last.spo2}% · FC ${last.hr} (${window.length}) · ${left}s`);
          } else if (bytes > 0) {
            onProgress(`Datos USB ${bytes} bytes @ ${baudRate} · ${left}s · mantén el dedo`);
          } else {
            onProgress(`0 bytes @ ${baudRate} · ${left}s · ¿oxímetro ENCENDIDO + dedo?`);
          }
        }
        continue;
      }

      const { value, done } = raced.r;
      if (done) break;
      if (!value?.length) continue;

      bytes += value.length;
      const merged = new Uint8Array(leftover.length + value.length);
      merged.set(leftover);
      merged.set(value, leftover.length);
      leftover = merged.length > 8192 ? merged.slice(merged.length - 4096) : merged;

      for (const reading of [
        ...parseClassic5(leftover),
        ...parseV7(leftover),
        ...parseLoose(leftover),
      ]) {
        window.push(reading);
      }

      const stable = stableOf(window, 2);
      if (stable) return stable;
    }

    if (bytes === 0) {
      onProgress(`Sin datos @ ${baudRate} (0 bytes). Enciende el oxímetro y pon el dedo.`);
    } else {
      onProgress(`Hubo ${bytes} bytes @ ${baudRate} pero sin SpO2 estable`);
    }
    return null;
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      writer.releaseLock();
    } catch {
      /* ignore */
    }
    await ensureClosed(port);
  }
}

async function pickSiliconLabsPort(onProgress: (msg: string) => void): Promise<SerialPortLike> {
  const nav = navigator as Navigator & {
    serial?: {
      getPorts: () => Promise<SerialPortLike[]>;
      requestPort: (options?: {
        filters?: Array<{ usbVendorId: number }>;
      }) => Promise<SerialPortLike>;
    };
  };
  if (!nav.serial) {
    throw new Error("Usa Chrome o Edge (no Firefox) para lectura USB.");
  }

  onProgress("Elige Silicon Labs CP210x (no Intel)…");
  try {
    return await nav.serial.requestPort({ filters: [{ usbVendorId: SILICON_LABS_VID }] });
  } catch (err) {
    const known = await nav.serial.getPorts();
    const silicon = known.find((p) => p.getInfo?.().usbVendorId === SILICON_LABS_VID);
    if (silicon) return silicon;
    if (err instanceof Error && /No port selected|NotFoundError/i.test(err.name + err.message)) {
      throw new Error("No elegiste el puerto. Pulsa de nuevo y elige Silicon Labs CP210x.");
    }
    return nav.serial.requestPort();
  }
}

async function tryLocalBridge(
  onProgress: (msg: string) => void,
): Promise<{ spo2: number; hr: number; via: "bridge" } | null> {
  onProgress("Servicio local 127.0.0.1:3927…");
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
      onProgress(
        data.error ||
          `Servicio local sin lectura (bytes=${data.bytes ?? "?"}). Probando Web Serial…`,
      );
      return null;
    }
    if (
      typeof data.oxygenSaturation === "number" &&
      typeof data.heartRate === "number" &&
      data.oxygenSaturation >= 70 &&
      data.oxygenSaturation <= 100
    ) {
      return { spo2: data.oxygenSaturation, hr: data.heartRate, via: "bridge" };
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|abort/i.test(msg)) {
      onProgress("Servicio local no disponible → Web Serial");
      return null;
    }
    if (/private|local network|Permission/i.test(msg)) {
      onProgress(
        "Chrome bloqueó red local. Permite acceso a red local para este sitio, o usa Web Serial.",
      );
      return null;
    }
    onProgress(`Puente: ${msg}. Probando Web Serial…`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function bridgeHealthy(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function readCms50DPlus(onProgress: (msg: string) => void): Promise<{
  spo2: number;
  hr: number;
  via: "bridge" | "web-serial";
}> {
  // Prefer local Node service (owns COM4). Do NOT open Web Serial while bridge is up.
  const localUp = await bridgeHealthy();
  if (localUp) {
    const fromBridge = await tryLocalBridge(onProgress);
    if (fromBridge) return fromBridge;
    throw new Error(
      "El servicio local está activo pero no obtuvo SpO2. Enciende el oxímetro, pon el dedo (debe verse en la pantalla del aparato) y reintenta. Si el servicio no debe usarse, cierra iniciar-servicio-oximetro.bat y usa solo Web Serial.",
    );
  }

  onProgress("Web Serial @ 19200 — verás 0 bytes o N bytes en vivo");
  const port = await pickSiliconLabsPort(onProgress);

  const fast = await readAtBaud(port, 19200, 15000, onProgress);
  if (fast) return { ...fast, via: "web-serial" };

  onProgress("Reintentando @ 115200…");
  const slow = await readAtBaud(port, 115200, 12000, onProgress);
  if (slow) return { ...slow, via: "web-serial" };

  throw new Error(
    "0 bytes o sin SpO2 estable. 1) Oxímetro ENCENDIDO (pantalla con números) 2) Dedo 10 s 3) Cierra otras pestañas USB 4) Mejor: abre iniciar-servicio-oximetro.bat y deja esa ventana abierta, luego pulsa de nuevo.",
  );
}

export function UsbOximeterReader({
  deviceId,
  patients,
}: {
  deviceId: number;
  patients: PatientOption[];
}) {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [patientId, setPatientId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const canSerial = useMemo(() => typeof navigator !== "undefined" && "serial" in navigator, []);

  async function onRead() {
    setError("");
    setBusy(true);
    setStatus("Iniciando…");
    try {
      const sample = await readCms50DPlus((msg) => setStatus(msg));
      setStatus(
        `Listo (${sample.via}): SpO2 ${sample.spo2}% · FC ${sample.hr}. Guardando…`,
      );
      startTransition(async () => {
        try {
          const result = await recordUsbOximeterReading({
            medicalDeviceId: deviceId,
            oxygenSaturation: sample.spo2,
            heartRate: sample.hr,
            patientId: patientId ? Number(patientId) : undefined,
            syncToVitals: Boolean(patientId),
          });
          if (result && "error" in result) {
            setError(result.error);
            setStatus("");
          } else {
            setStatus(`Guardado: SpO2 ${sample.spo2}% · FC ${sample.hr} (${sample.via})`);
          }
        } finally {
          setBusy(false);
        }
      });
    } catch (err) {
      setBusy(false);
      setStatus("");
      setError(err instanceof Error ? err.message : "Error al leer el oxímetro");
    }
  }

  return (
    <section className={`${cardClassName} mt-6 border-teal-200 bg-teal-50/40`}>
      <h2 className="mb-2 font-medium text-slate-900">Lectura automática USB (CMS50D+)</h2>
      <p className="mb-4 text-sm text-slate-600">
        Estación: deja abierto{" "}
        <code className="rounded bg-white/80 px-1">iniciar-servicio-oximetro.bat</code> (puerto
        3927). El botón usa ese servicio primero; si no está, usa Web Serial. Oxímetro{" "}
        <strong>encendido</strong> + dedo (debe verse SpO2 en la pantalla del aparato).
        {canSerial ? "" : " Este navegador no soporta Web Serial; usa el .bat del servicio."}
      </p>
      <FormAlert error={error || undefined} success={status && !error ? status : undefined} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Paciente (opcional)</label>
          <select
            className={inputClassName}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">— Sin paciente —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRead}
          disabled={pending || busy}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {busy || pending ? "Leyendo…" : "Leer oxímetro ahora"}
        </button>
      </div>
    </section>
  );
}
