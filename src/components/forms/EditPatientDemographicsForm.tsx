"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePatientDemographics } from "@/lib/actions/patients";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
  cardClassName,
} from "@/lib/ui/classes";

type PatientDefaults = {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  curp?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
};

export function EditPatientDemographicsForm({
  patientId,
  patient,
}: {
  patientId: number;
  patient: PatientDefaults;
}) {
  const router = useRouter();
  const action = updatePatientDemographics.bind(null, patientId);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Datos personales actualizados." : undefined}
      />

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Datos personales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" name="firstName" required defaultValue={patient.firstName} />
          <Field
            label="Apellido paterno *"
            name="lastNamePaternal"
            required
            defaultValue={patient.lastNamePaternal}
          />
          <Field
            label="Apellido materno"
            name="lastNameMaternal"
            defaultValue={patient.lastNameMaternal ?? ""}
          />
          <Field
            label="Fecha de nacimiento"
            name="birthDate"
            type="date"
            defaultValue={patient.birthDate ?? ""}
          />
          <div>
            <label className={labelClassName}>Sexo</label>
            <select name="sex" className={inputClassName} defaultValue={patient.sex ?? ""}>
              <option value="">—</option>
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
              <option value="Otro">Otro</option>
              {patient.sex &&
              !["Femenino", "Masculino", "Otro", ""].includes(patient.sex) ? (
                <option value={patient.sex}>{patient.sex}</option>
              ) : null}
            </select>
          </div>
          <Field label="CURP" name="curp" defaultValue={patient.curp ?? ""} />
          <Field label="Teléfono" name="phone" defaultValue={patient.phone ?? ""} />
          <Field
            label="Correo"
            name="email"
            type="email"
            defaultValue={patient.email ?? ""}
          />
          <div className="sm:col-span-2">
            <label className={labelClassName}>Domicilio</label>
            <textarea
              name="address"
              rows={2}
              className={textareaClassName}
              defaultValue={patient.address ?? ""}
            />
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Contacto de emergencia</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre"
            name="emergencyContactName"
            defaultValue={patient.emergencyContactName ?? ""}
          />
          <Field
            label="Teléfono"
            name="emergencyContactPhone"
            defaultValue={patient.emergencyContactPhone ?? ""}
          />
        </div>
      </section>

      <SubmitButton label="Guardar datos personales" pending={pending} />
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className={inputClassName}
      />
    </div>
  );
}
