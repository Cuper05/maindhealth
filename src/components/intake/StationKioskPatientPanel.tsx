import type { KioskAssessmentDraft, KioskVitalsDraft } from "@/lib/db/schema/station-kiosk";
import { cardClassName } from "@/lib/ui/classes";

type Props = {
  clinicalDraft?: Record<string, unknown> | null;
  vitalsDraft?: KioskVitalsDraft | null;
  assessmentDraft?: KioskAssessmentDraft | null;
  paymentStatus?: string | null;
};

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function boolLabel(v: unknown, label: string): string | null {
  return v === true ? label : null;
}

/** Panorama completo de lo que el paciente registró en el kiosco (síntomas, antecedentes, vitales, IA). */
export function StationKioskPatientPanel({
  clinicalDraft,
  vitalsDraft,
  assessmentDraft,
  paymentStatus,
}: Props) {
  const clinical = clinicalDraft ?? {};
  const chief = str(clinical.chiefComplaint);
  const meds = str(clinical.currentMedications);
  const allergyDetails = str(clinical.allergyDetails);
  const flags = [
    boolLabel(clinical.hasDiabetes, "Diabetes"),
    boolLabel(clinical.hasHypertension, "Hipertensión"),
    boolLabel(clinical.hasAsthma, "Asma"),
    boolLabel(clinical.hasHeartDisease, "Enfermedad cardíaca"),
    clinical.hasAllergies === true
      ? `Alergias${allergyDetails ? `: ${allergyDetails}` : ""}`
      : null,
    boolLabel(clinical.crisisMode, "Modo crisis / ayuda urgente"),
    boolLabel(clinical.crisisIntent, "Flujo de urgencia (pagó y escaló)"),
  ].filter(Boolean) as string[];

  const vitals = vitalsDraft;
  const hasVitals = Boolean(
    vitals &&
      (vitals.systolicPressure ||
        vitals.oxygenSaturation ||
        vitals.temperature ||
        vitals.weight ||
        vitals.heartRate ||
        vitals.ecgStatus),
  );

  const hasAssessment = Boolean(
    assessmentDraft &&
      (assessmentDraft.summary ||
        assessmentDraft.diagnosis ||
        (assessmentDraft.redFlags && assessmentDraft.redFlags.length > 0)),
  );

  if (!chief && flags.length === 0 && !hasVitals && !hasAssessment && !meds) {
    return (
      <section className={cardClassName}>
        <h2 className="font-medium text-slate-900">Datos del kiosco</h2>
        <p className="mt-2 text-sm text-slate-600">
          Aún no hay síntomas ni signos vitales registrados en estación para esta cita.
        </p>
      </section>
    );
  }

  return (
    <section className={cardClassName}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-medium text-slate-900">Registro del kiosco (estación)</h2>
        {paymentStatus ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            Pago: {paymentStatus}
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        {chief ? (
          <div className="md:col-span-2">
            <dt className="text-slate-500">Síntomas / motivo</dt>
            <dd className="whitespace-pre-wrap text-slate-900">{chief}</dd>
          </div>
        ) : null}

        {flags.length > 0 ? (
          <div className="md:col-span-2">
            <dt className="text-slate-500">Antecedentes reportados</dt>
            <dd className="text-slate-900">{flags.join(" · ")}</dd>
          </div>
        ) : null}

        {meds ? (
          <div className="md:col-span-2">
            <dt className="text-slate-500">Medicamentos actuales</dt>
            <dd className="text-slate-900">{meds}</dd>
          </div>
        ) : null}

        {hasVitals && vitals ? (
          <div className="md:col-span-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-3">
            <dt className="font-medium text-teal-900">Signos vitales (estación)</dt>
            <dd className="mt-2 grid gap-1 text-slate-800 sm:grid-cols-2">
              {(vitals.systolicPressure || vitals.diastolicPressure) && (
                <p>
                  PA {vitals.systolicPressure ?? "—"}/{vitals.diastolicPressure ?? "—"} mmHg
                </p>
              )}
              {vitals.heartRate && <p>FC {vitals.heartRate} lpm</p>}
              {vitals.oxygenSaturation && <p>SpO₂ {vitals.oxygenSaturation}%</p>}
              {vitals.temperature && <p>Temp {vitals.temperature} °C</p>}
              {vitals.weight && <p>Peso {vitals.weight} kg</p>}
              {vitals.height && <p>Talla {vitals.height} m</p>}
              {vitals.bmi && <p>IMC {vitals.bmi}</p>}
              {vitals.ecgStatus && (
                <p>
                  ECG: {vitals.ecgRhythm ?? vitals.ecgStatus}
                  {vitals.ecgHeartRate ? ` · FC ${vitals.ecgHeartRate}` : ""}
                </p>
              )}
            </dd>
          </div>
        ) : null}

        {hasAssessment && assessmentDraft ? (
          <div className="md:col-span-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-3">
            <dt className="font-medium text-amber-950">Evaluación de estación</dt>
            <dd className="mt-2 space-y-1 text-slate-800">
              {assessmentDraft.diagnosis ? (
                <p>
                  <span className="text-slate-500">Diagnóstico sugerido: </span>
                  {assessmentDraft.diagnosis}
                </p>
              ) : null}
              {assessmentDraft.severity ? (
                <p>
                  <span className="text-slate-500">Severidad: </span>
                  {assessmentDraft.severity}
                </p>
              ) : null}
              {assessmentDraft.summary ? (
                <p className="whitespace-pre-wrap">{assessmentDraft.summary}</p>
              ) : null}
              {assessmentDraft.redFlags && assessmentDraft.redFlags.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-950">
                  {assessmentDraft.redFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
