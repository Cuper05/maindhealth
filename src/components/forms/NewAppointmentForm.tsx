"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/lib/actions/appointments";
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

type DoctorOption = {
  id: number;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
  specialty?: string | null;
};

type TypeOption = { id: number; name: string };

export function NewAppointmentForm({
  patients,
  doctors,
  types,
  defaultPatientId,
}: {
  patients: PatientOption[];
  doctors: DoctorOption[];
  types: TypeOption[];
  defaultPatientId?: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createAppointment, null);

  useEffect(() => {
    if (state?.ok && "appointmentId" in state) {
      router.push(`/agenda/${state.appointmentId}`);
    }
  }, [state, router]);

  const defaultStart = new Date();
  defaultStart.setMinutes(defaultStart.getMinutes() + 60 - (defaultStart.getMinutes() % 30));
  const defaultStartStr = defaultStart.toISOString().slice(0, 16);

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
            <label className={labelClassName}>Médico *</label>
            <select name="doctorId" required className={selectClassName}>
              <option value="">Seleccionar…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {optionLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Tipo de consulta</label>
            <select name="appointmentTypeId" className={selectClassName}>
              <option value="">—</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Modalidad *</label>
            <select name="modality" defaultValue="teleconsulta" className={selectClassName}>
              <option value="teleconsulta">Teleconsulta</option>
              <option value="presencial">Presencial</option>
              <option value="seguimiento">Seguimiento</option>
            </select>
          </div>
          <div>
            <label className={labelClassName}>Inicio *</label>
            <input
              type="datetime-local"
              name="startAt"
              required
              defaultValue={defaultStartStr}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>Fin</label>
            <input type="datetime-local" name="endAt" className={inputClassName} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Motivo de consulta</label>
            <textarea name="reason" rows={2} className={textareaClassName} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Enlace de videollamada</label>
            <input
              type="url"
              name="meetingUrl"
              placeholder="https://meet.example.com/..."
              className={inputClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Notas</label>
            <textarea name="notes" rows={2} className={textareaClassName} />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label="Agendar cita" pending={pending} />
        <CancelLink href="/agenda" />
      </div>
    </form>
  );
}
