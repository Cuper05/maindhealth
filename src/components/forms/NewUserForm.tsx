"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/lib/actions/users";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { cardClassName, inputClassName, labelClassName } from "@/lib/ui/classes";

export function NewUserForm({
  roles,
}: {
  roles: Array<{ code: string; name: string }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createUser, null);
  const [roleCode, setRoleCode] = useState("doctor");

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setRoleCode("doctor");
    router.refresh();
  }, [state, router]);

  const isDoctor = roleCode === "doctor";

  return (
    <form ref={formRef} action={formAction} className={`${cardClassName} space-y-4`}>
      <div>
        <h3 className="font-medium text-slate-900">Alta de usuario</h3>
        <p className="mt-1 text-sm text-slate-600">
          Un médico queda activo y en la cola de teleconsulta. Entra al sistema y a la
          app del celular con este correo y contraseña.
        </p>
      </div>

      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Usuario dado de alta." : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Rol *</label>
          <select
            name="roleCode"
            required
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
            className={inputClassName}
          >
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <Field label="Nombre *" name="firstName" required />
        <Field label="Apellido paterno *" name="lastNamePaternal" required />
        <Field label="Apellido materno" name="lastNameMaternal" />
        <Field label="Correo *" name="email" type="email" required autoComplete="off" />
        <Field
          label={isDoctor ? "Teléfono * (alertas de teleconsulta)" : "Teléfono"}
          name="phone"
          type="tel"
          placeholder="10 dígitos o +52…"
        />
        <Field label="Especialidad" name="specialty" />
        <Field
          label={isDoctor ? "Cédula profesional *" : "Cédula profesional"}
          name="professionalLicense"
        />
        <Field
          label="Contraseña *"
          name="password"
          type="password"
          required
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
        />
      </div>

      {isDoctor ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="teleconsultaAvailable"
            value="on"
            defaultChecked
            className="size-4 rounded border-slate-300 text-teal-700"
          />
          Disponible para teleconsulta / alertas
        </label>
      ) : null}

      <SubmitButton label="Dar de alta" pending={pending} />
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
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
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClassName}
      />
    </div>
  );
}
