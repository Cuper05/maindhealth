"use client";

import { useMemo, useState, useTransition } from "react";
import { recordUsbOximeterReading } from "@/lib/actions/usb-oximeter";
import { FormAlert } from "@/components/ui/PageHeader";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

type PatientOption = { id: number; label: string };

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};

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

function stableOf(window: { spo2: number; hr: number }[], need = 5) {
  if (window.length < need) return null;
  const recent = window.slice(-need);
  const spo2 = recent.map((r) => r.spo2);
  const hr = recent.map((r) => r.hr);
  if (Math.max(...spo2) - Math.min(...spo2) > 2) return null;
  if (Math.max(...hr) - Math.min(...hr) > 10) return null;
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { spo2: avg(spo2), hr: avg(hr) };
}

async function readCms50DPlus(): Promise<{ spo2: number; hr: number }> {
  const nav = navigator as Navigator & {
    serial?: {
      requestPort: () => Promise<SerialPortLike>;
    };
  };
  if (!nav.serial) {
    throw new Error("Este navegador no soporta USB Serial. Usa Chrome o Edge.");
  }

  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 19200 });

  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) {
    await port.close();
    throw new Error("No se pudo abrir lectura/escritura del puerto USB.");
  }

  const startCmd = new Uint8Array([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);
  await writer.write(startCmd);

  const window: { spo2: number; hr: number }[] = [];
  let leftover = new Uint8Array(0);
  const deadline = Date.now() + 25000;

  try {
    while (Date.now() < deadline) {
      await writer.write(startCmd);
      const result = await Promise.race([
        reader.read(),
        new Promise<{ value?: Uint8Array; done: boolean }>((resolve) =>
          setTimeout(() => resolve({ done: false, value: new Uint8Array() }), 800),
        ),
      ]);
      if (result.done) break;
      const chunk = result.value || new Uint8Array();
      if (!chunk.length) continue;

      const merged = new Uint8Array(leftover.length + chunk.length);
      merged.set(leftover);
      merged.set(chunk, leftover.length);
      leftover = merged.length > 4096 ? merged.slice(merged.length - 2048) : merged;

      for (const reading of parseClassic5(leftover)) {
        window.push(reading);
      }
      const stable = stableOf(window);
      if (stable) return stable;
    }
    throw new Error(
      "No se obtuvo lectura estable. Enciende el CMS50D+, ponte el dedo y elige el puerto Silicon Labs / COM del oxímetro.",
    );
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
  const [pending, startTransition] = useTransition();
  const canSerial = useMemo(() => typeof navigator !== "undefined" && "serial" in navigator, []);

  async function onRead() {
    setError("");
    setStatus("Conectando oxímetro por USB…");
    try {
      const sample = await readCms50DPlus();
      setStatus(`Lectura: SpO2 ${sample.spo2}% · FC ${sample.hr}. Guardando…`);
      startTransition(async () => {
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
      });
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "Error al leer el oxímetro");
    }
  }

  return (
    <section className={`${cardClassName} mt-6 border-teal-200 bg-teal-50/40`}>
      <h2 className="mb-2 font-medium text-slate-900">Lectura automática USB (CMS50D+)</h2>
      <p className="mb-4 text-sm text-slate-600">
        Conecta el oxímetro, enciéndelo, ponte el dedo y pulsa el botón. La lectura se guarda sola
        en el sistema (Chrome/Edge).
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
      <div className="mt-4">
        <button
          type="button"
          onClick={onRead}
          disabled={pending || !canSerial}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Leer oxímetro por USB"}
        </button>
        {!canSerial ? (
          <p className="mt-2 text-sm text-amber-800">
            Abre MaindHealth en Chrome o Edge para usar USB.
          </p>
        ) : null}
      </div>
    </section>
  );
}
