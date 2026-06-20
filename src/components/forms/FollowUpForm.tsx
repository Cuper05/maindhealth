"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFollowUp } from "@/lib/actions/follow-ups";
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

type ConsultationOption = {
  id: number;
  diagnosis: string | null;
  consultedAt: Date;
  patientId: number;
};

export function FollowUpForm({
  patients,
  doctors,
  consultations,
  defaultPatientId,
  defaultConsultationId,
  defaultDoctorId,
  redirectTo,
}: {
  patients: PatientOption[];
  doctors: DoctorOption[];
  consultations: ConsultationOption[];
  defaultPatientId?: number;
  defaultConsultationId?: number;
  defaultDoctorId?: number;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createFollowUp, null);

  useEffect(() => {
    if (state?.ok && "patientId" in state) {
      router.push(redirectTo ?? `/pacientes/${state.patientId}?tab=seguimientos`);
      router.refresh();
    }
  }, [state, router, redirectTo]);

  const now = new Date();
  const defaultFollowUpAt = now.toISOString().slice(0, 16);

  const filteredConsultations = defaultPatientId
    ? consultations.filter((c) => c.patientId === defaultPatientId)
    : consultations;

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
            <select
              name="doctorId"
              required
              defaultValue={defaultDoctorId ?? ""}
              className={selectClassName}
            >
              <option value="">Seleccionar…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {optionLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Consulta vinculada (opcional)</label>
            <select
              name="consultationId"
              defaultValue={defaultConsultationId ?? ""}
              className={selectClassName}
            >
              <option value="">Sin consulta vinculada</option>
              {filteredConsultations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.consultedAt.toLocaleString("es-MX")} — {c.diagnosis ?? "Consulta"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Fecha de seguimiento *</label>
            <input
              type="datetime-local"
              name="followUpAt"
              required
              defaultValue={defaultFollowUpAt}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>Próxima revisión</label>
            <input
              type="datetime-local"
              name="nextReviewAt"
              className={inputClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Evolución *</label>
            <textarea
              name="evolution"
              required
              rows={4}
              placeholder="Estado actual del paciente, respuesta al tratamiento…"
              className={textareaClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Observaciones</label>
            <textarea name="notes" rows={3} className={textareaClassName} />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label="Registrar seguimiento" pending={pending} />
        <CancelLink href={redirectTo ?? "/seguimientos"} />
      </div>
    </form>
  );
}
