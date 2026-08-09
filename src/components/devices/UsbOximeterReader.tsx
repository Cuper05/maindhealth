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
        "Puerto USB ocupado. Cierra esta pestaña, vuelve a abrirla, o desconecta/reconecta el USB del oxímetro. No uses ningún .bat. Luego elige Silicon Labs CP210x.",
      );
    }
    throw err;
  }
  try {
    await port.setSignals?.({ dataTerminalReady: true, requestToSend: false });
  } catch {
    /* optional */
  }
}

/**
 * Lee sin colgarse: reader.read() bloquea para siempre si no hay datos.
 * Aquí se combina con un tick para respetar el timeout.
 */
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
      if (Date.now() - lastPing > 800) {
        await writer.write(PING_CMD);
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
        if (Date.now() - lastStatus > 700) {
          lastStatus = Date.now();
          const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          if (window.length > 0) {
            const last = window[window.length - 1]!;
            onProgress(`SpO2 ${last.spo2}% · FC ${last.hr} (${window.length}) · ${left}s`);
          } else if (bytes > 0) {
            onProgress(`Datos USB ${bytes} bytes @ ${baudRate} · ${left}s · mantén el dedo`);
          } else {
            onProgress(`Esperando datos @ ${baudRate} · ${left}s · dedo firme`);
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

      for (const reading of [...parseClassic5(leftover), ...parseLoose(leftover)]) {
        window.push(reading);
      }

      const stable = stableOf(window, 2);
      if (stable) return stable;
    }

    if (bytes === 0) {
      onProgress(`Sin datos @ ${baudRate}. ¿Oxímetro encendido y dedo puesto?`);
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

async function readCms50DPlus(onProgress: (msg: string) => void): Promise<{ spo2: number; hr: number }> {
  const port = await pickSiliconLabsPort(onProgress);

  onProgress("Leyendo @ 19200… mantén el dedo");
  const fast = await readAtBaud(port, 19200, 15000, onProgress);
  if (fast) return fast;

  onProgress("Reintentando @ 115200…");
  const slow = await readAtBaud(port, 115200, 12000, onProgress);
  if (slow) return slow;

  throw new Error(
    "No hubo lectura válida. Enciende el oxímetro, pon el dedo 10 s, cierra otras pestañas, desconecta/reconecta USB y reintenta con Silicon Labs CP210x.",
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
      if (!canSerial) {
        throw new Error("Abre esta página en Chrome o Edge.");
      }
      const sample = await readCms50DPlus((msg) => setStatus(msg));
      setStatus(`Listo: SpO2 ${sample.spo2}% · FC ${sample.hr}. Guardando…`);
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
        Antes: cierra otras pestañas de esta página y no uses el .bat. Luego: oxímetro encendido +
        dedo + botón → <strong>Silicon Labs CP210x</strong>.
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
