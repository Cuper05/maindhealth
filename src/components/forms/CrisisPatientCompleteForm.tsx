"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePatientDemographics } from "@/lib/actions/patients";
import { cardClassName } from "@/lib/ui/classes";

type Props = {
  patientId: number;
  appointmentId: number;
  defaults?: {
    firstName?: string;
    lastNamePaternal?: string;
    lastNameMaternal?: string | null;
    birthDate?: string | null;
    sex?: string | null;
    phone?: string | null;
  };
};

/**
 * Alta demográfica cuando el paciente entró por «ayuda urgente»
 * (placeholder Paciente Urgencia) y el médico ya lo tranquilizó.
 */
export function CrisisPatientCompleteForm({
  patientId,
  appointmentId,
  defaults,
}: Props) {
  const router = useRouter();
  const action = updatePatientDemographics.bind(null, patientId);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const isPlaceholder =
    (defaults?.firstName === "Paciente" && defaults?.lastNamePaternal === "Urgencia") ||
    (defaults?.firstName === "Pendiente" && defaults?.lastNamePaternal === "Identificación");

  return (
    <section className={`${cardClassName} mb-6 border-2 border-red-200 bg-red-50/40`}>
      <h2 className="text-base font-semibold text-red-950">
        Completar alta del paciente (urgencia)
      </h2>
      <p className="mt-1 text-sm text-red-900/80">
        {isPlaceholder
          ? "Entró como «Paciente Urgencia». Tras tranquilizarlo, registre nombre, teléfono y datos básicos."
          : "Actualice o complete los datos del paciente de esta atención de urgencia."}
      </p>

      <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Nombre *</span>
          <input
            name="firstName"
            required
            defaultValue={isPlaceholder ? "" : defaults?.firstName ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Nombre(s)"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Apellido paterno *</span>
          <input
            name="lastNamePaternal"
            required
            defaultValue={isPlaceholder ? "" : defaults?.lastNamePaternal ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Apellido materno</span>
          <input
            name="lastNameMaternal"
            defaultValue={defaults?.lastNameMaternal ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Teléfono</span>
          <input
            name="phone"
            defaultValue={
              defaults?.phone?.startsWith("crisis-") ? "" : (defaults?.phone ?? "")
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="10 dígitos"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Fecha de nacimiento</span>
          <input
            type="date"
            name="birthDate"
            defaultValue={defaults?.birthDate ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Sexo</span>
          <select
            name="sex"
            defaultValue={defaults?.sex ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">—</option>
            <option value="female">Femenino</option>
            <option value="male">Masculino</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Alergias</span>
          <input
            name="allergies"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Ninguna / detalle"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Medicamentos actuales</span>
          <input
            name="currentMedications"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Condiciones crónicas</span>
          <input
            name="chronicConditions"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        {state && !state.ok ? (
          <p className="sm:col-span-2 text-sm text-red-700">{state.error}</p>
        ) : null}
        {state?.ok ? (
          <p className="sm:col-span-2 text-sm font-medium text-emerald-700">
            Datos del paciente guardados.
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar alta del paciente"}
          </button>
        </div>
      </form>
    </section>
  );
}
