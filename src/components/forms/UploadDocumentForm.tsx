"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadClinicalDocument } from "@/lib/actions/clinical-documents";
import { optionLabel } from "@/lib/format/name";
import {
  FormAlert,
  SubmitButton,
  CancelLink,
} from "@/components/ui/PageHeader";
import {
  labelClassName,
  textareaClassName,
  selectClassName,
  cardClassName,
} from "@/lib/ui/classes";

type PatientOption = {
  id: number;
  chartNumber: string;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
};

type DocumentTypeOption = {
  id: number;
  name: string;
};

type ConsultationOption = {
  id: number;
  diagnosis: string | null;
  consultedAt: Date;
  patientId: number;
};

export function UploadDocumentForm({
  patients,
  documentTypes,
  consultations,
  defaultPatientId,
  defaultConsultationId,
  redirectTo,
}: {
  patients: PatientOption[];
  documentTypes: DocumentTypeOption[];
  consultations: ConsultationOption[];
  defaultPatientId?: number;
  defaultConsultationId?: number;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(uploadClinicalDocument, null);

  useEffect(() => {
    if (state?.ok && "patientId" in state) {
      router.push(
        redirectTo ?? `/pacientes/${state.patientId}?tab=documentos`,
      );
      router.refresh();
    }
  }, [state, router, redirectTo]);

  const filteredConsultations = defaultPatientId
    ? consultations.filter((c) => c.patientId === defaultPatientId)
    : consultations;

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert error={state && !state.ok ? state.error : undefined} />

      <section className={cardClassName}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Paciente *</label>
            <select
              name="patientId"
              required
              defaultValue={defaultPatientId ?? ""}
              className={selectClassName}
            >
              <option value="">Seleccionar…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {optionLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Tipo de documento *</label>
            <select name="documentTypeId" required className={selectClassName}>
              <option value="">Seleccionar…</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Consulta vinculada (opcional)</label>
            <select
              name="consultationId"
              defaultValue={defaultConsultationId ?? ""}
              className={selectClassName}
            >
              <option value="">Sin consulta vinculada</option>
              {filteredConsultations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.consultedAt.toLocaleString("es-MX")} — {c.diagnosis ?? "Consulta"}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Archivo * (PDF, JPG, PNG, WEBP — máx. 10 MB)</label>
            <input
              type="file"
              name="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal-800 hover:file:bg-teal-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Observaciones</label>
            <textarea name="notes" rows={3} className={textareaClassName} />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label="Cargar documento" pending={pending} />
        <CancelLink href={redirectTo ?? "/documentos"} />
      </div>
    </form>
  );
}
