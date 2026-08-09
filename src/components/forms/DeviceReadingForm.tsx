"use client";

import { useActionState } from "react";
import { recordDeviceReading } from "@/lib/actions/device-readings";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { inputClassName, labelClassName, cardClassName } from "@/lib/ui/classes";

export function DeviceReadingForm({
  deviceId,
  patients,
}: {
  deviceId: number;
  patients: { id: number; label: string }[];
}) {
  const [state, action, pending] = useActionState(recordDeviceReading, null);

  return (
    <section className={`${cardClassName} mt-6`}>
      <h2 className="mb-2 font-medium text-slate-900">Registrar lectura del equipo</h2>
      <p className="mb-4 text-sm text-slate-600">
        Respaldo <strong>manual</strong> (solo si USB falla). Para el oxímetro usa primero
        <strong> Lectura automática USB</strong> arriba.
      </p>
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Lectura registrada" : undefined}
      />
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="medicalDeviceId" value={deviceId} />
        <div>
          <label className={labelClassName}>Paciente (opcional)</label>
          <select name="patientId" className={inputClassName}>
            <option value="">— Sin paciente —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName}>PA sistólica</label>
          <input name="systolicPressure" className={inputClassName} placeholder="120" />
        </div>
        <div>
          <label className={labelClassName}>PA diastólica</label>
          <input name="diastolicPressure" className={inputClassName} placeholder="80" />
        </div>
        <div>
          <label className={labelClassName}>FC</label>
          <input name="heartRate" className={inputClassName} placeholder="72" />
        </div>
        <div>
          <label className={labelClassName}>SpO2 (%) — oxímetro</label>
          <input name="oxygenSaturation" className={inputClassName} placeholder="98" />
        </div>
        <div>
          <label className={labelClassName}>Temperatura °C</label>
          <input name="temperature" className={inputClassName} placeholder="36.5" />
        </div>
        <div>
          <label className={labelClassName}>Peso kg</label>
          <input name="weight" className={inputClassName} placeholder="70" />
        </div>
        <div>
          <label className={labelClassName}>Glucosa</label>
          <input name="glucose" className={inputClassName} placeholder="95" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="syncToVitals" defaultChecked />
            Crear captura en triage / signos vitales (requiere paciente)
          </label>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton label="Registrar lectura" pending={pending} />
        </div>
      </form>
    </section>
  );
}
