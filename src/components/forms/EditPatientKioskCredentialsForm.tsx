"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePatientKioskCredentials } from "@/lib/actions/patients";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

export function EditPatientKioskCredentialsForm({
  patientId,
  kioskUsername,
  hasPassword,
}: {
  patientId: number;
  kioskUsername?: string | null;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const action = updatePatientKioskCredentials.bind(null, patientId);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className={`${cardClassName} space-y-4`}>
      <div>
        <h2 className="font-medium text-slate-900">Acceso al kiosco</h2>
        <p className="mt-1 text-sm text-slate-500">
          Usuario y contraseña para que el paciente reingrese en la estación sin volver a
          registrarse.
          {hasPassword
            ? " Deje la contraseña en blanco para conservar la actual."
            : " Aún no tiene contraseña configurada."}
        </p>
      </div>

      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Acceso de kiosco actualizado." : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Usuario</label>
          <input
            name="kioskUsername"
            autoComplete="off"
            defaultValue={kioskUsername ?? ""}
            placeholder="ej. chelseaperez"
            className={inputClassName}
            minLength={3}
          />
        </div>
        <div>
          <label className={labelClassName}>
            {hasPassword ? "Nueva contraseña" : "Contraseña"}
          </label>
          <input
            type="password"
            name="kioskPassword"
            autoComplete="new-password"
            placeholder={hasPassword ? "•••••••• (sin cambios)" : "Mínimo 4 caracteres"}
            className={inputClassName}
            minLength={4}
          />
        </div>
      </div>

      {hasPassword || kioskUsername ? (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="clearCredentials" className="rounded border-slate-300" />
          Quitar usuario y contraseña de kiosco
        </label>
      ) : null}

      <SubmitButton
        label={hasPassword || kioskUsername ? "Guardar acceso kiosco" : "Crear acceso kiosco"}
        pending={pending}
      />
    </form>
  );
}
