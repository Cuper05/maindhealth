import {
  ALCOHOL_USE_LABELS,
  SMOKING_STATUS_LABELS,
  type visitIntakesTable,
} from "@/lib/db/schema/visit-intakes";
import { formatDetailListForDisplay } from "@/lib/intake/list-details";
import {
  buildChiefComplaintFromSelection,
  type SymptomSelection,
} from "@/lib/kiosk/symptom-catalog";
import { cardClassName } from "@/lib/ui/classes";

type Intake = typeof visitIntakesTable.$inferSelect;

function formatSymptomSelection(raw: unknown): string | null {
  const selection = raw as SymptomSelection | null | undefined;
  if (!selection || !Array.isArray(selection.primary) || selection.primary.length === 0) {
    return null;
  }
  const text = buildChiefComplaintFromSelection(selection).trim();
  return text || null;
}

export function IntakeSummary({ intake }: { intake: Intake }) {
  const flags = [
    intake.hasDiabetes && `Diabetes: ${intake.diabetesDetails ?? "—"}`,
    intake.hasHypertension && `Hipertensión: ${intake.hypertensionDetails ?? "—"}`,
    intake.hasAsthma && "Asma",
    intake.hasHeartDisease && `Cardíaco: ${intake.heartDiseaseDetails ?? "—"}`,
    intake.hasAllergies && `Alergias: ${formatDetailListForDisplay(intake.allergyDetails)}`,
    intake.hasSurgeries && `Cirugías: ${formatDetailListForDisplay(intake.surgeryDetails)}`,
  ].filter(Boolean) as string[];
  const symptoms = formatSymptomSelection(intake.symptomSelection);

  return (
    <section className={cardClassName}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-medium text-slate-900">Cuestionario de estación</h2>
        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
          Completado{" "}
          {intake.completedAt.toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Motivo de consulta</dt>
          <dd className="text-slate-900">{intake.chiefComplaint}</dd>
        </div>
        {symptoms && (
          <div>
            <dt className="text-slate-500">Síntomas estructurados (kiosco)</dt>
            <dd className="text-slate-900">{symptoms}</dd>
          </div>
        )}
        {flags.length > 0 && (
          <div>
            <dt className="text-slate-500">Antecedentes reportados</dt>
            <dd className="text-slate-900">{flags.join(" · ")}</dd>
          </div>
        )}
        {intake.otherChronicConditions && (
          <div>
            <dt className="text-slate-500">Otros crónicos</dt>
            <dd>{intake.otherChronicConditions}</dd>
          </div>
        )}
        {intake.currentMedications && (
          <div>
            <dt className="text-slate-500">Medicamentos</dt>
            <dd>{intake.currentMedications}</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Hábitos</dt>
          <dd>
            Tabaco:{" "}
            {SMOKING_STATUS_LABELS[intake.smokingStatus as keyof typeof SMOKING_STATUS_LABELS] ??
              intake.smokingStatus}
            {" · "}
            Alcohol:{" "}
            {ALCOHOL_USE_LABELS[intake.alcoholUse as keyof typeof ALCOHOL_USE_LABELS] ??
              intake.alcoholUse}
          </dd>
        </div>
        {intake.changesSinceLastVisit && (
          <div>
            <dt className="text-slate-500">Cambios recientes</dt>
            <dd>{intake.changesSinceLastVisit}</dd>
          </div>
        )}
        {intake.consentSignerName && (
          <div>
            <dt className="text-slate-500">Consentimiento</dt>
            <dd>
              Firmado por {intake.consentSignerName}
              {intake.consentAcceptedAt &&
                ` · ${intake.consentAcceptedAt.toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}`}
            </dd>
          </div>
        )}
        {intake.source && (
          <div>
            <dt className="text-slate-500">Origen</dt>
            <dd>{intake.source}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
