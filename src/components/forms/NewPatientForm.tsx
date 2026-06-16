"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPatient } from "@/lib/actions/patients";
import {
  FormAlert,
  SubmitButton,
  CancelLink,
} from "@/components/ui/PageHeader";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
  cardClassName,
} from "@/lib/ui/classes";

export function NewPatientForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createPatient, null);

  useEffect(() => {
    if (state?.ok && "patientId" in state) {
      router.push(`/pacientes/${state.patientId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert error={state && !state.ok ? state.error : undefined} />

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Datos generales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" name="firstName" required />
          <Field label="Apellido paterno *" name="lastNamePaternal" required />
          <Field label="Apellido materno" name="lastNameMaternal" />
          <Field label="Fecha de nacimiento" name="birthDate" type="date" />
          <div>
            <label className={labelClassName}>Sexo</label>
            <select name="sex" className={inputClassName}>
              <option value="">—</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <Field label="CURP" name="curp" />
          <Field label="Teléfono" name="phone" />
          <Field label="Correo" name="email" type="email" />
          <div className="sm:col-span-2">
            <label className={labelClassName}>Domicilio</label>
            <textarea name="address" rows={2} className={textareaClassName} />
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Contacto de emergencia</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="emergencyContactName" />
          <Field label="Teléfono" name="emergencyContactPhone" />
        </div>
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Datos clínicos iniciales</h2>
        <div className="grid gap-4">
          <TextArea label="Alergias" name="allergies" />
          <TextArea label="Enfermedades crónicas" name="chronicConditions" />
          <TextArea label="Medicamentos actuales" name="currentMedications" />
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label="Registrar paciente" pending={pending} />
        <CancelLink href="/pacientes" />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        className={inputClassName}
      />
    </div>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <textarea name={name} rows={2} className={textareaClassName} />
    </div>
  );
}
