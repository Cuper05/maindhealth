"use client";

import { useMemo, useState, useTransition } from "react";
import { recordUsbOximeterReading } from "@/lib/actions/usb-oximeter";
import { FormAlert } from "@/components/ui/PageHeader";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

type PatientOption = { id: number; label: string };

type SerialPortLike = {
  open: (options: { baudRate: number; bufferSize?: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

const LOCAL_BRIDGE = "http://127.0.0.1:3927";
const SILICON_LABS_VID = 0x10c4;
const START_CMD = new Uint8Array([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);

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

function stableOf(window: { spo2: number; hr: number }[], need = 3) {
  if (window.length < need) return null;
  const recent = window.slice(-need);
  const spo2 = recent.map((r) => r.spo2);
  const hr = recent.map((r) => r.hr);
  if (Math.max(...spo2) - Math.min(...spo2) > 3) return null;
  if (Math.max(...hr) - Math.min(...hr) > 15) return null;
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { spo2: avg(spo2), hr: avg(hr) };
}

async function readAtBaud(
  port: SerialPortLike,
  baudRate: number,
  maxMs: number,
  onProgress: (msg: string) => void,
): Promise<{ spo2: number; hr: number } | null> {
  await port.open({ baudRate, bufferSize: 8192 });
  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) {
    await port.close();
    throw new Error("No se pudo abrir el puerto USB.");
  }

  try {
    await writer.write(START_CMD);
    const window: { spo2: number; hr: number }[] = [];
    let leftover = new Uint8Array(0);
    let bytes = 0;
    const deadline = Date.now() + maxMs;
    let lastPing = 0;

    while (Date.now() < deadline) {
      if (Date.now() - lastPing > 700) {
        await writer.write(START_CMD);
        lastPing = Date.now();
      }

      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.length) continue;

      bytes += value.length;
      const merged = new Uint8Array(leftover.length + value.length);
      merged.set(leftover);
      merged.set(value, leftover.length);
      leftover = merged.length > 8192 ? merged.slice(merged.length - 4096) : merged;

      for (const reading of parseClassic5(leftover)) window.push(reading);

      if (window.length > 0) {
        const last = window[window.length - 1]!;
        onProgress(`SpO2 ${last.spo2}% · FC ${last.hr} (${window.length} muestras)`);
      } else if (bytes > 0) {
        onProgress(`Recibiendo datos… ${bytes} bytes`);
      } else {
        onProgress(`Esperando señal @ ${baudRate}…`);
      }

      const stable = stableOf(window, 3);
      if (stable) return stable;
    }
    return null;
  } finally {
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
    try {
      await port.close();
    } catch {
      /* ignore */
    }
  }
}

async function readViaWebSerial(onProgress: (msg: string) => void): Promise<{ spo2: number; hr: number }> {
  const nav = navigator as Navigator & {
    serial?: {
      getPorts: () => Promise<SerialPortLike[]>;
      requestPort: (options?: {
        filters?: Array<{ usbVendorId: number }>;
      }) => Promise<SerialPortLike>;
    };
  };
  if (!nav.serial) {
    throw new Error("Usa Chrome o Edge para lectura USB.");
  }

  let port: SerialPortLike | undefined;
  const known = await nav.serial.getPorts();
  port = known.find((p) => p.getInfo?.().usbVendorId === SILICON_LABS_VID) || known[0];

  if (!port) {
    onProgress("Elige Silicon Labs CP210x (no Intel)…");
    try {
      port = await nav.serial.requestPort({ filters: [{ usbVendorId: SILICON_LABS_VID }] });
    } catch {
      port = await nav.serial.requestPort();
    }
  } else {
    onProgress("Usando puerto USB ya autorizado…");
  }

  onProgress("Leyendo @ 19200… mantén el dedo 5–10 s");
  const fast = await readAtBaud(port, 19200, 12000, onProgress);
  if (fast) return fast;

  onProgress("Reintentando @ 115200…");
  const slow = await readAtBaud(port, 115200, 8000, onProgress);
  if (slow) return slow;

  throw new Error(
    "No hubo lectura a tiempo. Oxímetro encendido, dedo firme, y elige Silicon Labs CP210x (no Intel).",
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

  async function readFromLocalBridge(): Promise<{ spo2: number; hr: number }> {
    setStatus("Contactando servicio local…");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const health = await fetch(`${LOCAL_BRIDGE}/health`, { signal: controller.signal });
      if (!health.ok) throw new Error("Servicio local no responde");
    } finally {
      clearTimeout(timer);
    }

    setStatus("Leyendo por servicio local…");
    const readController = new AbortController();
    const readTimer = setTimeout(() => readController.abort(), 20000);
    try {
      const res = await fetch(`${LOCAL_BRIDGE}/read`, {
        method: "POST",
        signal: readController.signal,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        oxygenSaturation?: number;
        heartRate?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "El servicio local no pudo leer el oxímetro");
      }
      return {
        spo2: Number(data.oxygenSaturation),
        hr: Number(data.heartRate),
      };
    } finally {
      clearTimeout(readTimer);
    }
  }

  async function onRead() {
    setError("");
    setBusy(true);
    setStatus("Iniciando lectura…");
    try {
      let sample: { spo2: number; hr: number } | null = null;

      try {
        sample = await readFromLocalBridge();
      } catch {
        if (!canSerial) {
          throw new Error(
            "Chrome bloqueó el servicio local. En el candado del sitio → Configuración del sitio → Acceso a red local → Permitir. O usa Chrome/Edge con Web Serial.",
          );
        }
        setStatus("Servicio local no disponible. Usando USB directo…");
        sample = await readViaWebSerial((msg) => setStatus(msg));
      }

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
        Oxímetro encendido + dedo + este botón. Si Chrome pide permiso de red local o de puerto USB,
        elige <strong>Permitir</strong> y <strong>Silicon Labs CP210x</strong> (no Intel).
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
