"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createLabResult } from "@/lib/actions/lab-results";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { inputClassName, labelClassName, textareaClassName } from "@/lib/ui/classes";

export function LabResultForm({
  patients,
  defaultPatientId,
  defaultAppointmentId,
  redirect,
}: {
  patients: { id: number; label: string }[];
  defaultPatientId?: number;
  defaultAppointmentId?: number;
  redirect?: string;
}) {
  const [state, action, pending] = useActionState(createLabResult, null);

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {redirect && <input type="hidden" name="redirect" value={redirect} />}
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Resultado registrado" : undefined}
      />
      <div>
        <label className={labelClassName}>Paciente *</label>
        <select name="patientId" defaultValue={defaultPatientId} className={inputClassName} required>
          <option value="">Selecciona…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {defaultAppointmentId && (
        <input type="hidden" name="appointmentId" value={defaultAppointmentId} />
      )}
      <div>
        <label className={labelClassName}>Estudio *</label>
        <input name="testName" className={inputClassName} placeholder="Biometría hemática" required />
      </div>
      <div>
        <label className={labelClassName}>Código (opcional)</label>
        <input name="testCode" className={inputClassName} placeholder="BH-001" />
      </div>
      <div>
        <label className={labelClassName}>Resultados (JSON) *</label>
        <textarea
          name="resultsJson"
          rows={8}
          className={textareaClassName}
          defaultValue={'{\n  "hemoglobina": "14.2 g/dL",\n  "leucocitos": "6.5 x10³/µL"\n}'}
          required
        />
      </div>
      <div>
        <label className={labelClassName}>Notas</label>
        <textarea name="notes" rows={2} className={textareaClassName} />
      </div>
      <div className="flex gap-3">
        <SubmitButton label="Guardar resultado" pending={pending} />
        <Link href="/laboratorio" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
