"use client";

import { useActionState } from "react";
import { updateDoctorTeleconsultaContact } from "@/lib/actions/users";
import { buttonPrimaryClassName, inputClassName } from "@/lib/ui/classes";

type Props = {
  userId: number;
  phone: string | null;
  teleconsultaAvailable: boolean;
};

export function DoctorTeleconsultaContactForm({
  userId,
  phone,
  teleconsultaAvailable,
}: Props) {
  const [state, action, pending] = useActionState(
    updateDoctorTeleconsultaContact,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="min-w-[10rem] flex-1">
        <span className="mb-0.5 block text-xs text-slate-500">Teléfono</span>
        <input
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder="+52 55… o 10 dígitos"
          className={inputClassName}
          autoComplete="tel"
        />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="teleconsultaAvailable"
          value="on"
          defaultChecked={teleconsultaAvailable}
          className="size-4 rounded border-slate-300 text-teal-700"
        />
        Disponible teleconsulta
      </label>
      <button type="submit" disabled={pending} className={buttonPrimaryClassName}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {state && !state.ok ? (
        <p className="w-full text-xs text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="w-full text-xs text-teal-700">Guardado</p>
      ) : null}
    </form>
  );
}
