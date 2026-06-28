"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitVisitIntake } from "@/lib/actions/visit-intake";
import {
  ALCOHOL_USE_LABELS,
  SMOKING_STATUS_LABELS,
  type AlcoholUseLevel,
  type SmokingStatus,
} from "@/lib/db/schema/visit-intakes";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { YesNoDetailList } from "@/components/intake/YesNoDetailList";
import {
  cardClassName,
  inputClassName,
  labelClassName,
  selectClassName,
  textareaClassName,
} from "@/lib/ui/classes";

type RecordHints = {
  allergies?: string | null;
  chronicConditions?: string | null;
  previousSurgeries?: string | null;
  currentMedications?: string | null;
} | null;

export function StationIntakeForm({
  appointmentId,
  defaultChiefComplaint,
  recordHints,
  redirectTo,
}: {
  appointmentId: number;
  defaultChiefComplaint?: string | null;
  recordHints: RecordHints;
  redirectTo: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitVisitIntake, null);

  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [hasHypertension, setHasHypertension] = useState(false);
  const [hasHeartDisease, setHasHeartDisease] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [hasSurgeries, setHasSurgeries] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState("");
  const [surgeryDetails, setSurgeryDetails] = useState("");

  useEffect(() => {
    if (state?.ok && "appointmentId" in state) {
      router.push(redirectTo);
    }
  }, [state, router, redirectTo]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormAlert error={state && !state.ok ? state.error : undefined} />

      {recordHints && (
        <section className={`${cardClassName} border-amber-100 bg-amber-50/50`}>
          <h2 className="text-sm font-medium text-amber-900">Expediente previo (referencia)</h2>
          <dl className="mt-2 grid gap-1 text-sm text-amber-900/80">
            {recordHints.chronicConditions && (
              <div>
                <dt className="font-medium">Crónicos</dt>
                <dd>{recordHints.chronicConditions}</dd>
              </div>
            )}
            {recordHints.allergies && (
              <div>
                <dt className="font-medium">Alergias</dt>
                <dd>{recordHints.allergies}</dd>
              </div>
            )}
            {recordHints.previousSurgeries && (
              <div>
                <dt className="font-medium">Cirugías</dt>
                <dd>{recordHints.previousSurgeries}</dd>
              </div>
            )}
            {recordHints.currentMedications && (
              <div>
                <dt className="font-medium">Medicamentos</dt>
                <dd>{recordHints.currentMedications}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-amber-800">
            Confirma o actualiza con el paciente en el formulario.
          </p>
        </section>
      )}

      <section className={cardClassName}>
        <h2 className="mb-4 text-sm font-medium text-slate-900">Motivo de la consulta de hoy</h2>
        <textarea
          name="chiefComplaint"
          rows={3}
          required
          minLength={3}
          defaultValue={defaultChiefComplaint ?? ""}
          placeholder="¿Por qué acude el paciente hoy?"
          className={textareaClassName}
        />
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 text-sm font-medium text-slate-900">Antecedentes de salud</h2>
        <div className="space-y-5">
          <YesNoField
            label="¿Diabetes?"
            name="hasDiabetes"
            checked={hasDiabetes}
            onChange={setHasDiabetes}
            detailName="diabetesDetails"
            detailPlaceholder="Tipo, medicamento, control…"
          />
          <YesNoField
            label="¿Hipertensión?"
            name="hasHypertension"
            checked={hasHypertension}
            onChange={setHasHypertension}
            detailName="hypertensionDetails"
            detailPlaceholder="Medicamento, última PA conocida…"
          />
          <YesNoField
            label="¿Enfermedad cardíaca?"
            name="hasHeartDisease"
            checked={hasHeartDisease}
            onChange={setHasHeartDisease}
            detailName="heartDiseaseDetails"
            detailPlaceholder="Diagnóstico, tratamiento…"
          />
          <YesNoDetailList
            label="¿Alergias a medicamentos o sustancias?"
            checked={hasAllergies}
            onCheckedChange={setHasAllergies}
            value={allergyDetails}
            onChange={setAllergyDetails}
            placeholder="A qué es alérgico y reacción…"
            addLabel="Agregar otra alergia"
            detailName="allergyDetails"
          />
          <input type="hidden" name="hasAllergies" value={hasAllergies ? "yes" : "no"} />
          <YesNoDetailList
            label="¿Cirugías previas?"
            checked={hasSurgeries}
            onCheckedChange={setHasSurgeries}
            value={surgeryDetails}
            onChange={setSurgeryDetails}
            placeholder="Procedimiento y año aproximado…"
            addLabel="Agregar otra cirugía"
            detailName="surgeryDetails"
          />
          <input type="hidden" name="hasSurgeries" value={hasSurgeries ? "yes" : "no"} />
          <div>
            <label className={labelClassName}>Otras enfermedades crónicas</label>
            <textarea
              name="otherChronicConditions"
              rows={2}
              className={textareaClassName}
              placeholder="Asma, hipotiroidismo, etc."
            />
          </div>
          <div>
            <label className={labelClassName}>Medicamentos actuales</label>
            <textarea
              name="currentMedications"
              rows={2}
              className={textareaClassName}
              placeholder="Nombre, dosis y frecuencia"
            />
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 text-sm font-medium text-slate-900">Hábitos y cambios recientes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Tabaco</label>
            <select name="smokingStatus" defaultValue="never" className={selectClassName}>
              {(Object.entries(SMOKING_STATUS_LABELS) as [SmokingStatus, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Alcohol</label>
            <select name="alcoholUse" defaultValue="none" className={selectClassName}>
              {(Object.entries(ALCOHOL_USE_LABELS) as [AlcoholUseLevel, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>¿Cambió algo desde su última visita?</label>
            <textarea name="changesSinceLastVisit" rows={2} className={textareaClassName} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Notas adicionales</label>
            <textarea name="additionalNotes" rows={2} className={textareaClassName} />
          </div>
        </div>
      </section>

      <SubmitButton
        label="Completar cuestionario y continuar"
        pendingLabel="Guardando…"
        pending={pending}
      />
    </form>
  );
}

function YesNoField({
  label,
  name,
  checked,
  onChange,
  detailName,
  detailPlaceholder,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  detailName: string;
  detailPlaceholder: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <p className={labelClassName}>{label}</p>
      <div className="mt-2 flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value="no"
            checked={!checked}
            onChange={() => onChange(false)}
          />
          No
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value="yes"
            checked={checked}
            onChange={() => onChange(true)}
          />
          Sí
        </label>
      </div>
      {checked && (
        <input
          type="text"
          name={detailName}
          required
          placeholder={detailPlaceholder}
          className={`${inputClassName} mt-3`}
        />
      )}
    </div>
  );
}
