"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CatalogAutocomplete } from "@/components/forms/CatalogAutocomplete";
import { saveConsultation } from "@/lib/actions/consultations";
import { savePrescription } from "@/lib/actions/prescriptions";
import {
  findMedicationMatch,
  type MedicationCatalogOption,
} from "@/lib/catalog/format-options";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
  cardClassName,
  buttonSecondaryClassName,
} from "@/lib/ui/classes";

type ConsultationData = {
  id?: number;
  reason?: string | null;
  currentIllness?: string | null;
  physicalExam?: string | null;
  diagnosis?: string | null;
  treatmentPlan?: string | null;
  instructions?: string | null;
  clinicalSummary?: string | null;
};

type PrescriptionItem = {
  medication: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  instructions?: string;
};

type PrescriptionData = {
  id?: number;
  generalNotes?: string | null;
  items: PrescriptionItem[];
};

type CatalogAutocompleteOption = {
  value: string;
  label: string;
};

export function ConsultationWorkspace({
  appointmentId,
  patientId,
  consultation,
  prescription,
  diagnosisOptions = [],
  symptomOptions = [],
  medicationOptions = [],
  canWriteConsultation,
  canWritePrescription,
  canWriteFollowUp,
  canUploadDocuments,
}: {
  appointmentId: number;
  patientId: number;
  consultation: ConsultationData | null;
  prescription: PrescriptionData | null;
  diagnosisOptions?: CatalogAutocompleteOption[];
  symptomOptions?: CatalogAutocompleteOption[];
  medicationOptions?: MedicationCatalogOption[];
  canWriteConsultation: boolean;
  canWritePrescription: boolean;
  canWriteFollowUp?: boolean;
  canUploadDocuments?: boolean;
}) {
  const [consultState, consultAction, consultPending] = useActionState(
    saveConsultation,
    null,
  );
  const [consultationId, setConsultationId] = useState(consultation?.id);
  const [prescriptionId, setPrescriptionId] = useState(prescription?.id);
  const [rxError, setRxError] = useState<string>();
  const [rxSuccess, setRxSuccess] = useState<string>();
  const [rxPending, setRxPending] = useState(false);

  const [items, setItems] = useState<PrescriptionItem[]>(
    prescription?.items?.length
      ? prescription.items
      : [{ medication: "", dose: "", frequency: "", duration: "", route: "", instructions: "" }],
  );
  const [generalNotes, setGeneralNotes] = useState(prescription?.generalNotes ?? "");
  const [currentIllness, setCurrentIllness] = useState(consultation?.currentIllness ?? "");
  const [diagnosis, setDiagnosis] = useState(consultation?.diagnosis ?? "");

  const activeConsultationId =
    consultationId ??
    (consultState?.ok && "consultationId" in consultState
      ? consultState.consultationId
      : undefined);

  useEffect(() => {
    if (consultState?.ok && "consultationId" in consultState) {
      setConsultationId(consultState.consultationId);
    }
  }, [consultState]);

  async function handlePrescriptionSave() {
    if (!activeConsultationId) {
      setRxError("Guarda la consulta antes de emitir la receta");
      return;
    }
    setRxPending(true);
    setRxError(undefined);
    setRxSuccess(undefined);

    const result = await savePrescription({
      consultationId: activeConsultationId,
      generalNotes: generalNotes || undefined,
      items: items.filter((i) => i.medication.trim()),
    });

    setRxPending(false);
    if (!result.ok) {
      setRxError(result.error);
      return;
    }
    if ("prescriptionId" in result) {
      setPrescriptionId(result.prescriptionId);
      setRxSuccess("Receta guardada. Ya puedes descargar el PDF.");
    }
  }

  function updateItem(index: number, field: keyof PrescriptionItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function updateMedication(index: number, value: string) {
    const match = findMedicationMatch(medicationOptions, value);
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (!match) return { ...item, medication: value };
        return {
          ...item,
          medication: match.name,
          dose: item.dose?.trim() ? item.dose : match.strength ?? "",
          route: item.route?.trim() ? item.route : match.form ?? "",
        };
      }),
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { medication: "", dose: "", frequency: "", duration: "", route: "", instructions: "" },
    ]);
  }

  return (
    <div className="space-y-6">
      <section className={cardClassName}>
        <h2 className="mb-4 text-lg font-medium text-slate-900">Nota médica</h2>
        <FormAlert
          error={consultState && !consultState.ok ? consultState.error : undefined}
          success={consultState?.ok ? "Consulta guardada" : undefined}
        />

        {canWriteConsultation ? (
          <form action={consultAction} className="space-y-4">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <TextArea
              label="Motivo de consulta"
              name="reason"
              defaultValue={consultation?.reason}
            />
            {symptomOptions.length > 0 ? (
              <CatalogAutocomplete
                label="Padecimiento actual"
                name="currentIllness"
                value={currentIllness}
                onChange={setCurrentIllness}
                options={symptomOptions}
                rows={3}
                hint="Escribe libremente o elige síntomas del catálogo."
              />
            ) : (
              <TextArea
                label="Padecimiento actual"
                name="currentIllness"
                defaultValue={consultation?.currentIllness}
              />
            )}
            <TextArea
              label="Exploración general"
              name="physicalExam"
              defaultValue={consultation?.physicalExam}
            />
            {diagnosisOptions.length > 0 ? (
              <CatalogAutocomplete
                label="Diagnóstico *"
                name="diagnosis"
                required
                value={diagnosis}
                onChange={setDiagnosis}
                options={diagnosisOptions}
                rows={3}
                hint="Escribe libremente o elige un diagnóstico del catálogo (CIE-10)."
              />
            ) : (
              <TextArea
                label="Diagnóstico *"
                name="diagnosis"
                required
                defaultValue={consultation?.diagnosis}
              />
            )}
            <TextArea
              label="Plan de tratamiento"
              name="treatmentPlan"
              defaultValue={consultation?.treatmentPlan}
            />
            <TextArea
              label="Indicaciones"
              name="instructions"
              defaultValue={consultation?.instructions}
            />
            <TextArea
              label="Resumen clínico"
              name="clinicalSummary"
              defaultValue={consultation?.clinicalSummary}
            />
            <SubmitButton label="Guardar consulta" pending={consultPending} />
          </form>
        ) : (
          <ReadOnlyConsultation consultation={consultation} />
        )}
      </section>

      {canWritePrescription && (
        <section className={cardClassName}>
          <h2 className="mb-4 text-lg font-medium text-slate-900">Receta</h2>
          <FormAlert error={rxError} success={rxSuccess} />

          {!activeConsultationId && (
            <p className="mb-4 text-sm text-amber-700">
              Guarda la consulta primero para vincular la receta.
            </p>
          )}

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 p-4"
              >
                <p className="mb-3 text-sm font-medium text-slate-700">
                  Medicamento {index + 1}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {medicationOptions.length > 0 ? (
                    <MedicationCatalogField
                      label="Medicamento *"
                      value={item.medication}
                      options={medicationOptions}
                      onChange={(v) => updateMedication(index, v)}
                    />
                  ) : (
                    <InputField
                      label="Medicamento *"
                      value={item.medication}
                      onChange={(v) => updateItem(index, "medication", v)}
                    />
                  )}
                  <InputField
                    label="Dosis"
                    value={item.dose ?? ""}
                    onChange={(v) => updateItem(index, "dose", v)}
                  />
                  <InputField
                    label="Frecuencia"
                    value={item.frequency ?? ""}
                    onChange={(v) => updateItem(index, "frequency", v)}
                  />
                  <InputField
                    label="Duración"
                    value={item.duration ?? ""}
                    onChange={(v) => updateItem(index, "duration", v)}
                  />
                  <InputField
                    label="Vía"
                    value={item.route ?? ""}
                    onChange={(v) => updateItem(index, "route", v)}
                  />
                  <InputField
                    label="Indicaciones"
                    value={item.instructions ?? ""}
                    onChange={(v) => updateItem(index, "instructions", v)}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className={`mt-3 ${buttonSecondaryClassName}`}
          >
            + Agregar medicamento
          </button>

          <div className="mt-4">
            <label className={labelClassName}>Observaciones generales</label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className={textareaClassName}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrescriptionSave}
              disabled={rxPending || !activeConsultationId}
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {rxPending ? "Guardando…" : "Guardar receta"}
            </button>
            {prescriptionId && (
              <a
                href={`/api/prescriptions/${prescriptionId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonSecondaryClassName}
              >
                Descargar PDF
              </a>
            )}
          </div>
        </section>
      )}

      {canWriteFollowUp && activeConsultationId && (
        <section className={cardClassName}>
          <h2 className="mb-2 text-lg font-medium text-slate-900">Seguimiento</h2>
          <p className="mb-3 text-sm text-slate-600">
            Registra la evolución del paciente y programa la próxima revisión.
          </p>
          <Link
            href={`/seguimientos/nuevo?patientId=${patientId}&consultationId=${activeConsultationId}&redirect=/consultas/cita/${appointmentId}`}
            className={buttonSecondaryClassName}
          >
            Registrar seguimiento
          </Link>
        </section>
      )}

      {canUploadDocuments && activeConsultationId && (
        <section className={cardClassName}>
          <h2 className="mb-2 text-lg font-medium text-slate-900">Documentos</h2>
          <p className="mb-3 text-sm text-slate-600">
            Adjunta laboratorios, imágenes o reportes a esta consulta.
          </p>
          <Link
            href={`/documentos/nuevo?patientId=${patientId}&consultationId=${activeConsultationId}&redirect=/consultas/cita/${appointmentId}`}
            className={buttonSecondaryClassName}
          >
            Cargar documento
          </Link>
        </section>
      )}
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <textarea
        name={name}
        required={required}
        rows={3}
        defaultValue={defaultValue ?? ""}
        className={textareaClassName}
      />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
      />
    </div>
  );
}

function MedicationCatalogField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: MedicationCatalogOption[];
  onChange: (value: string) => void;
}) {
  const listId = "catalog-medications";

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder="Escribe o elige del catálogo"
        className={inputClassName}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.name} value={option.datalistValue}>
            {[option.strength, option.form].filter(Boolean).join(" · ")}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function ReadOnlyConsultation({
  consultation,
}: {
  consultation: ConsultationData | null;
}) {
  if (!consultation) {
    return <p className="text-sm text-slate-500">Sin consulta registrada.</p>;
  }
  const fields = [
    ["Motivo", consultation.reason],
    ["Padecimiento actual", consultation.currentIllness],
    ["Exploración", consultation.physicalExam],
    ["Diagnóstico", consultation.diagnosis],
    ["Plan", consultation.treatmentPlan],
    ["Indicaciones", consultation.instructions],
    ["Resumen", consultation.clinicalSummary],
  ] as const;

  return (
    <dl className="space-y-3 text-sm">
      {fields.map(([label, value]) =>
        value ? (
          <div key={label}>
            <dt className="font-medium text-slate-700">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-600">{value}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}
