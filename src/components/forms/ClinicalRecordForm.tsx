"use client";

import { useActionState } from "react";
import { updateClinicalRecord } from "@/lib/actions/patients";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { labelClassName, textareaClassName, cardClassName } from "@/lib/ui/classes";

type RecordData = {
  allergies?: string | null;
  familyHistory?: string | null;
  pathologicalHistory?: string | null;
  nonPathologicalHistory?: string | null;
  previousSurgeries?: string | null;
  chronicConditions?: string | null;
  currentMedications?: string | null;
  generalNotes?: string | null;
};

export function ClinicalRecordForm({
  patientId,
  record,
}: {
  patientId: number;
  record: RecordData | null;
}) {
  const boundAction = updateClinicalRecord.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Expediente actualizado" : undefined}
      />

      <section className={cardClassName}>
        <div className="grid gap-4">
          <TextArea label="Alergias" name="allergies" defaultValue={record?.allergies} />
          <TextArea
            label="Antecedentes heredofamiliares"
            name="familyHistory"
            defaultValue={record?.familyHistory}
          />
          <TextArea
            label="Antecedentes patológicos"
            name="pathologicalHistory"
            defaultValue={record?.pathologicalHistory}
          />
          <TextArea
            label="Antecedentes no patológicos"
            name="nonPathologicalHistory"
            defaultValue={record?.nonPathologicalHistory}
          />
          <TextArea
            label="Cirugías previas"
            name="previousSurgeries"
            defaultValue={record?.previousSurgeries}
          />
          <TextArea
            label="Enfermedades crónicas"
            name="chronicConditions"
            defaultValue={record?.chronicConditions}
          />
          <TextArea
            label="Medicamentos actuales"
            name="currentMedications"
            defaultValue={record?.currentMedications}
          />
          <TextArea
            label="Observaciones generales"
            name="generalNotes"
            defaultValue={record?.generalNotes}
          />
        </div>
        <div className="mt-4">
          <SubmitButton label="Guardar expediente" pending={pending} />
        </div>
      </section>
    </form>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue ?? ""}
        className={textareaClassName}
      />
    </div>
  );
}
