"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { captureVitalSigns } from "@/lib/actions/vital-signs";
import { optionLabel } from "@/lib/format/name";
import {
  FormAlert,
  SubmitButton,
  CancelLink,
} from "@/components/ui/PageHeader";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
  selectClassName,
  cardClassName,
} from "@/lib/ui/classes";

type PatientOption = {
  id: number;
  chartNumber: string;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
};

type AppointmentOption = {
  id: number;
  startAt: Date;
  patientFirstName: string;
  patientLastNamePaternal: string;
  patientLastNameMaternal?: string | null;
};

export function VitalSignsForm({
  patients,
  appointments,
  defaultPatientId,
  defaultAppointmentId,
  redirectTo,
}: {
  patients: PatientOption[];
  appointments: AppointmentOption[];
  defaultPatientId?: number;
  defaultAppointmentId?: number;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(captureVitalSigns, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(redirectTo ?? "/triage");
      router.refresh();
    }
  }, [state, router, redirectTo]);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert error={state && !state.ok ? state.error : undefined} />

      <section className={cardClassName}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Paciente *</label>
            <select
              name="patientId"
              required
              defaultValue={defaultPatientId ?? ""}
              className={selectClassName}
            >
              <option value="">Seleccionar…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {optionLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Cita (opcional)</label>
            <select
              name="appointmentId"
              defaultValue={defaultAppointmentId ?? ""}
              className={selectClassName}
            >
              <option value="">Sin cita vinculada</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.startAt.toLocaleString("es-MX", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}{" "}
                  —{" "}
                  {optionLabel({
                    firstName: a.patientFirstName,
                    lastNamePaternal: a.patientLastNamePaternal,
                    lastNameMaternal: a.patientLastNameMaternal,
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Signos vitales</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label="Presión sistólica (mmHg)" name="systolicPressure" />
          <NumField label="Presión diastólica (mmHg)" name="diastolicPressure" />
          <NumField label="Frecuencia cardiaca (lpm)" name="heartRate" />
          <NumField label="SpO2 (%)" name="oxygenSaturation" />
          <NumField label="Temperatura (°C)" name="temperature" step="0.1" />
          <NumField label="Peso (kg)" name="weight" step="0.1" />
          <NumField label="Altura (cm)" name="height" step="0.1" />
          <NumField label="Glucosa (mg/dL)" name="glucose" />
        </div>
        <div className="mt-4">
          <label className={labelClassName}>Síntomas reportados</label>
          <textarea name="symptoms" rows={3} className={textareaClassName} />
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label="Guardar triage" pending={pending} />
        <CancelLink href={redirectTo ?? "/triage"} />
      </div>
    </form>
  );
}

function NumField({
  label,
  name,
  step = "1",
}: {
  label: string;
  name: string;
  step?: string;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input type="number" name={name} step={step} min="0" className={inputClassName} />
    </div>
  );
}
