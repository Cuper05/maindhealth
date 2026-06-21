"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { bookPortalAppointment } from "@/lib/actions/portal-appointments";
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

type DoctorOption = {
  id: number;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
  specialty?: string | null;
};

export function PortalAppointmentForm({ doctors }: { doctors: DoctorOption[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(bookPortalAppointment, null);

  useEffect(() => {
    if (state?.ok && "appointmentId" in state) {
      router.push(`/portal/citas/${state.appointmentId}`);
    }
  }, [state, router]);

  const defaultStart = new Date();
  defaultStart.setMinutes(defaultStart.getMinutes() + 60 - (defaultStart.getMinutes() % 30));
  const defaultStartStr = defaultStart.toISOString().slice(0, 16);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert error={state && !state.ok ? state.error : undefined} />

      <section className={cardClassName}>
        <p className="mb-4 text-sm text-slate-600">
          Elige médico, fecha y modalidad. Se generará un cargo de consulta ($350 MXN) pendiente de pago.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClassName}>Médico *</label>
            <select name="doctorId" required className={selectClassName}>
              <option value="">Seleccionar…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {optionLabel(d)}
                  {d.specialty ? ` — ${d.specialty}` : ""}
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
            <label className={labelClassName}>Fecha y hora *</label>
            <input
              type="datetime-local"
              name="startAt"
              required
              defaultValue={defaultStartStr}
              className={inputClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Motivo de consulta *</label>
            <textarea name="reason" rows={3} required className={textareaClassName} />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label="Agendar cita" pendingLabel="Agendando…" pending={pending} />
        <CancelLink href="/portal/citas" />
      </div>
    </form>
  );
}
