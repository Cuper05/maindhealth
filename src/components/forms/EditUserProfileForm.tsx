"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/lib/actions/users";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { UserAdminActions } from "@/components/forms/UserAdminActions";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

type Props = {
  user: {
    id: number;
    firstName: string;
    lastNamePaternal: string;
    lastNameMaternal?: string | null;
    email: string;
    phone?: string | null;
    specialty?: string | null;
    professionalLicense?: string | null;
    active: boolean;
    teleconsultaAvailable: boolean;
    roleCode: string;
    roleName: string;
  };
};

export function EditUserProfileForm({
  user,
  isAdmin = false,
}: Props & { isAdmin?: boolean }) {
  const router = useRouter();
  const action = updateUserProfile.bind(null, user.id);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const isDoctor = user.roleCode === "doctor";
  const displayName = `${user.firstName} ${user.lastNamePaternal}`.trim();

  return (
    <div className="space-y-3">
      <form action={formAction} className={`${cardClassName} space-y-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-medium text-slate-900">{displayName}</h3>
            <p className="text-xs text-slate-500">
              {user.roleName}
              {user.active ? " · Activo" : " · Inactivo"}
            </p>
          </div>
        </div>

      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Datos del usuario actualizados." : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre *" name="firstName" required defaultValue={user.firstName} />
        <Field
          label="Apellido paterno *"
          name="lastNamePaternal"
          required
          defaultValue={user.lastNamePaternal}
        />
        <Field
          label="Apellido materno"
          name="lastNameMaternal"
          defaultValue={user.lastNameMaternal ?? ""}
        />
        <Field label="Correo *" name="email" type="email" required defaultValue={user.email} />
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          defaultValue={user.phone ?? ""}
          placeholder="10 dígitos o +52…"
        />
        <Field label="Especialidad" name="specialty" defaultValue={user.specialty ?? ""} />
        <Field
          label="Cédula profesional"
          name="professionalLicense"
          defaultValue={user.professionalLicense ?? ""}
        />
        <Field
          label="Nueva contraseña (opcional)"
          name="password"
          type="password"
          placeholder="Dejar vacío para no cambiar"
          autoComplete="new-password"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="active"
            value="on"
            defaultChecked={user.active}
            className="size-4 rounded border-slate-300 text-teal-700"
          />
          Usuario activo
        </label>
        {isDoctor ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="teleconsultaAvailable"
              value="on"
              defaultChecked={user.teleconsultaAvailable}
              className="size-4 rounded border-slate-300 text-teal-700"
            />
            Disponible para teleconsulta / alertas
          </label>
        ) : null}
      </div>

      <SubmitButton label="Guardar datos" pending={pending} />
      </form>

      <UserAdminActions
        userId={user.id}
        displayName={displayName}
        active={user.active}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClassName}
      />
    </div>
  );
}
