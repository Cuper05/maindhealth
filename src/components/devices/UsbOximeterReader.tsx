"use client";

import { useState, useTransition } from "react";
import { recordUsbOximeterReading } from "@/lib/actions/usb-oximeter";
import { FormAlert } from "@/components/ui/PageHeader";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

type PatientOption = { id: number; label: string };

const LOCAL_BRIDGE = "http://127.0.0.1:3927";

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

  async function readFromLocalBridge(): Promise<{ spo2: number; hr: number }> {
    setStatus("Contactando servicio local del oxímetro…");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${LOCAL_BRIDGE}/read`, {
        method: "POST",
        signal: controller.signal,
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
      clearTimeout(timer);
    }
  }

  async function onRead() {
    setError("");
    setBusy(true);
    setStatus("Iniciando lectura…");
    try {
      // 1) Prefer local station service (reliable on this PC)
      let sample: { spo2: number; hr: number };
      try {
        sample = await readFromLocalBridge();
      } catch (bridgeErr) {
        const msg = bridgeErr instanceof Error ? bridgeErr.message : "";
        if (msg.includes("Failed to fetch") || msg.includes("abort") || msg.includes("NetworkError")) {
          throw new Error(
            "No se pudo contactar el servicio local (127.0.0.1:3927). Cierra y vuelve a abrir iniciar-servicio-oximetro.bat, recarga esta página y reintenta. Si Chrome pide permiso de red local, acéptalo.",
          );
        }
        throw bridgeErr;
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
        En esta PC debe estar abierto el servicio local (
        <code className="rounded bg-white px-1">iniciar-servicio-oximetro.bat</code>
        ). Luego: oxímetro encendido + dedo + este botón.
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
      <p className="mt-3 text-xs text-slate-500">
        Una vez por sesión en esta PC: abre{" "}
        <strong>iniciar-servicio-oximetro.bat</strong> y déjalo abierto.
      </p>
    </section>
  );
}
