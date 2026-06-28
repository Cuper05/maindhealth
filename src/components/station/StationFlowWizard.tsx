"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { lookupPatientByChart, registerStationWalkIn } from "@/lib/actions/station-flow";
import { submitStationIntakePayload } from "@/lib/actions/visit-intake";
import {
  ALCOHOL_USE_LABELS,
  SMOKING_STATUS_LABELS,
  type AlcoholUseLevel,
  type SmokingStatus,
} from "@/lib/db/schema/visit-intakes";
import { STATION_CONSENT_TEXT, STATION_VITALS_INSTRUCTIONS } from "@/lib/station/copy";
import { YesNoDetailList } from "@/components/intake/YesNoDetailList";
import { optionLabel } from "@/lib/format/name";
import {
  buttonPrimaryClassName,
  cardClassName,
  inputClassName,
  labelClassName,
  selectClassName,
  textareaClassName,
} from "@/lib/ui/classes";

const STEPS = [
  "Bienvenida",
  "Nuevo o recurrente",
  "Datos del paciente",
  "Formulario clínico",
  "Consentimiento",
  "Signos vitales",
  "Espera teleconsulta",
] as const;

type PendingAppointment = {
  id: number;
  patientId: number;
  patientName: string;
  chartNumber: string;
  startAt: string;
  doctorName: string;
  modality: string;
  reason: string | null;
  hasVitals?: boolean;
  intakeComplete?: boolean;
};

type DoctorOption = {
  id: number;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
  specialty?: string | null;
};

type PatientSummary = {
  id: number;
  chartNumber: string;
  name: string;
  birthDate?: string | null;
  sex?: string | null;
  phone?: string | null;
};

type ClinicalState = {
  chiefComplaint: string;
  hasDiabetes: boolean;
  diabetesDetails: string;
  hasHypertension: boolean;
  hypertensionDetails: string;
  hasHeartDisease: boolean;
  heartDiseaseDetails: string;
  hasAllergies: boolean;
  allergyDetails: string;
  hasSurgeries: boolean;
  surgeryDetails: string;
  otherChronicConditions: string;
  currentMedications: string;
  smokingStatus: SmokingStatus;
  alcoholUse: AlcoholUseLevel;
  changesSinceLastVisit: string;
  additionalNotes: string;
};

const emptyClinical = (): ClinicalState => ({
  chiefComplaint: "",
  hasDiabetes: false,
  diabetesDetails: "",
  hasHypertension: false,
  hypertensionDetails: "",
  hasHeartDisease: false,
  heartDiseaseDetails: "",
  hasAllergies: false,
  allergyDetails: "",
  hasSurgeries: false,
  surgeryDetails: "",
  otherChronicConditions: "",
  currentMedications: "",
  smokingStatus: "never",
  alcoholUse: "none",
  changesSinceLastVisit: "",
  additionalNotes: "",
});

export function StationFlowWizard({
  todayAppointments,
  doctors,
}: {
  todayAppointments: PendingAppointment[];
  doctors: DoctorOption[];
}) {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const pendingAppointments = useMemo(
    () => todayAppointments.filter((a) => !a.intakeComplete),
    [todayAppointments],
  );
  const [step, setStep] = useState(1);
  const [patientType, setPatientType] = useState<"new" | "returning" | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [newPatientRegistered, setNewPatientRegistered] = useState(false);
  const [hasVitals, setHasVitals] = useState(false);
  const [clinical, setClinical] = useState<ClinicalState>(emptyClinical);
  const [consentSignerName, setConsentSignerName] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentMeta, setAppointmentMeta] = useState<{
    startAt: string;
    doctorName: string;
    modality: string;
  } | null>(null);

  const selectedAppointment = useMemo(
    () => todayAppointments.find((a) => a.id === appointmentId) ?? null,
    [todayAppointments, appointmentId],
  );

  const displayAppointment = selectedAppointment ?? (appointmentMeta && appointmentId
    ? {
        id: appointmentId,
        patientId: patient?.id ?? 0,
        patientName: patient?.name ?? "",
        chartNumber: patient?.chartNumber ?? "",
        startAt: appointmentMeta.startAt,
        doctorName: appointmentMeta.doctorName,
        modality: appointmentMeta.modality,
        reason: clinical.chiefComplaint || null,
      }
    : null);

  useEffect(() => {
    const paso = searchParams.get("paso");
    const cita = searchParams.get("cita");
    if (paso === "7" && cita) {
      const id = Number(cita);
      const appt = todayAppointments.find((a) => a.id === id);
      if (appt) {
        setPatientType("returning");
        setAppointmentId(id);
        setPatient({
          id: appt.patientId,
          chartNumber: appt.chartNumber,
          name: appt.patientName,
        });
        setClinical((c) => ({ ...c, chiefComplaint: appt.reason ?? "" }));
        setConsentSignerName(appt.patientName);
        setHasVitals(appt.hasVitals ?? true);
        setAppointmentMeta({
          startAt: appt.startAt,
          doctorName: appt.doctorName,
          modality: appt.modality,
        });
        setStep(7);
      }
    }
  }, [searchParams, todayAppointments]);

  useEffect(() => {
    const paso = searchParams.get("paso");
    const cita = searchParams.get("cita");
    if (paso === "7" || !cita) return;
    const id = Number(cita);
    const appt = todayAppointments.find((a) => a.id === id);
    if (!appt || appt.intakeComplete) return;
    setPatientType("returning");
    setAppointmentId(appt.id);
    setPatient({
      id: appt.patientId,
      chartNumber: appt.chartNumber,
      name: appt.patientName,
    });
    setClinical((c) => ({ ...c, chiefComplaint: appt.reason ?? "" }));
    setConsentSignerName(appt.patientName);
    setHasVitals(appt.hasVitals ?? false);
    setAppointmentMeta({
      startAt: appt.startAt,
      doctorName: appt.doctorName,
      modality: appt.modality,
    });
    setStep(3);
  }, [searchParams, todayAppointments]);

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, 7));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function selectReturningAppointment(appt: PendingAppointment) {
    setAppointmentId(appt.id);
    setPatient({
      id: appt.patientId,
      chartNumber: appt.chartNumber,
      name: appt.patientName,
    });
    setClinical((c) => ({ ...c, chiefComplaint: appt.reason ?? "" }));
    setConsentSignerName(appt.patientName);
    setHasVitals(appt.hasVitals ?? false);
    setAppointmentMeta({
      startAt: appt.startAt,
      doctorName: appt.doctorName,
      modality: appt.modality,
    });
  }

  async function handleChartLookup(chartNumber: string) {
    setError(null);
    startTransition(async () => {
      const result = await lookupPatientByChart(chartNumber);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const appt = pendingAppointments.find((a) => a.patientId === result.patient.id);
      if (!appt) {
        setError("El paciente no tiene cita pendiente de intake hoy");
        return;
      }
      selectReturningAppointment(appt);
      setPatient({
        id: result.patient.id,
        chartNumber: result.patient.chartNumber,
        name: result.patient.name,
        birthDate: result.patient.birthDate,
        sex: result.patient.sex,
        phone: result.patient.phone,
      });
      setDataConfirmed(false);
    });
  }

  async function handleNewPatient(form: HTMLFormElement) {
    setError(null);
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await registerStationWalkIn(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAppointmentId(result.appointmentId);
      setPatient({
        id: result.patientId,
        chartNumber: result.chartNumber,
        name: `${formData.get("firstName")} ${formData.get("lastNamePaternal")}`.trim(),
        birthDate: String(formData.get("birthDate") ?? "") || null,
        sex: String(formData.get("sex") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
      });
      setAppointmentMeta({
        startAt: result.startAt,
        doctorName: result.doctorName,
        modality: result.modality,
      });
      setConsentSignerName(String(formData.get("firstName") ?? ""));
      setNewPatientRegistered(true);
      setDataConfirmed(false);
    });
  }

  async function handleConsentSubmit() {
    if (!appointmentId || !patientType) return;
    setError(null);
    startTransition(async () => {
      const result = await submitStationIntakePayload({
        appointmentId,
        patientType,
        consentSignerName,
        consentAccepted,
        ...clinical,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goNext();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <section className={`${cardClassName} text-center`}>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-600">MaindHealth</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Bienvenido al teleconsultorio</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-600">
            Te guiaremos paso a paso: identificación, antecedentes clínicos, consentimiento y preparación
            para tu consulta.
          </p>
          <button type="button" onClick={goNext} className={`${buttonPrimaryClassName} mt-8`}>
            Comenzar atención
          </button>
        </section>
      )}

      {step === 2 && (
        <section className={cardClassName}>
          <h2 className="text-lg font-medium text-slate-900">¿Es tu primera visita con nosotros?</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ChoiceCard
              title="Paciente recurrente"
              description="Ya tengo expediente y cita programada hoy."
              onClick={() => {
                setPatientType("returning");
                goNext();
              }}
            />
            <ChoiceCard
              title="Paciente nuevo"
              description="Primera vez en MaindHealth."
              onClick={() => {
                setPatientType("new");
                goNext();
              }}
            />
          </div>
          <button type="button" onClick={goBack} className="mt-6 text-sm text-slate-600 hover:text-teal-700">
            ← Atrás
          </button>
        </section>
      )}

      {step === 3 && patientType === "returning" && (
        <section className={cardClassName}>
          <h2 className="text-lg font-medium text-slate-900">Identifica tu cita</h2>
          <p className="mt-1 text-sm text-slate-600">Selecciona tu nombre o busca por expediente.</p>

          <div className="mt-4 space-y-2">
            {pendingAppointments.map((appt) => (
              <button
                key={appt.id}
                type="button"
                onClick={() => selectReturningAppointment(appt)}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${
                  appointmentId === appt.id
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 hover:border-teal-200"
                }`}
              >
                <span className="font-medium">{appt.patientName}</span>
                <span className="text-slate-500"> · {appt.chartNumber}</span>
                <br />
                <span className="text-slate-600">
                  {new Date(appt.startAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · Dr(a). {appt.doctorName}
                </span>
              </button>
            ))}
          </div>

          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const chart = new FormData(e.currentTarget).get("chartNumber");
              handleChartLookup(String(chart ?? ""));
            }}
          >
            <input
              name="chartNumber"
              placeholder="Buscar expediente (ej. MH-000001)"
              className={inputClassName}
            />
            <button type="submit" disabled={pending} className={buttonPrimaryClassName}>
              Buscar
            </button>
          </form>

          {patient && (
            <DataConfirmPanel
              patient={patient}
              dataConfirmed={dataConfirmed}
              onConfirmChange={setDataConfirmed}
            />
          )}

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={goBack} className="text-sm text-slate-600">
              ← Atrás
            </button>
            <button
              type="button"
              disabled={!patient || !dataConfirmed}
              onClick={goNext}
              className={buttonPrimaryClassName}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {step === 3 && patientType === "new" && !newPatientRegistered && (
        <section className={cardClassName}>
          <h2 className="text-lg font-medium text-slate-900">Captura de datos — paciente nuevo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Registra los datos básicos. Después confirmarás la información con el paciente.
          </p>
          <form
            id="new-patient-form"
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleNewPatient(e.currentTarget);
            }}
          >
            <Field label="Nombre *" name="firstName" required />
            <Field label="Apellido paterno *" name="lastNamePaternal" required />
            <Field label="Apellido materno" name="lastNameMaternal" />
            <Field label="Fecha de nacimiento" name="birthDate" type="date" />
            <div>
              <label className={labelClassName}>Sexo</label>
              <select name="sex" className={selectClassName}>
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
            </div>
            <Field label="Teléfono" name="phone" />
            <div className="sm:col-span-2">
              <label className={labelClassName}>Médico para la consulta *</label>
              <select name="doctorId" required className={selectClassName}>
                <option value="">Seleccionar…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {optionLabel(d)}
                    {d.specialty ? ` — ${d.specialty}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </form>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={goBack} className="text-sm text-slate-600">
              ← Atrás
            </button>
            <button type="submit" form="new-patient-form" disabled={pending} className={buttonPrimaryClassName}>
              {pending ? "Registrando…" : "Guardar datos"}
            </button>
          </div>
        </section>
      )}

      {step === 3 && patientType === "new" && newPatientRegistered && patient && (
        <section className={cardClassName}>
          <h2 className="text-lg font-medium text-slate-900">Confirmar datos del paciente</h2>
          <p className="mt-1 text-sm text-slate-600">
            Revisa con el paciente que la información sea correcta antes de continuar.
          </p>
          <DataConfirmPanel
            patient={patient}
            dataConfirmed={dataConfirmed}
            onConfirmChange={setDataConfirmed}
          />
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setNewPatientRegistered(false);
                setDataConfirmed(false);
              }}
              className="text-sm text-slate-600"
            >
              ← Editar datos
            </button>
            <button
              type="button"
              disabled={!dataConfirmed}
              onClick={goNext}
              className={buttonPrimaryClassName}
            >
              Confirmar y continuar
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <ClinicalStep
          clinical={clinical}
          setClinical={setClinical}
          onBack={goBack}
          onNext={() => {
            if (clinical.chiefComplaint.trim().length < 3) {
              setError("Describe el motivo de consulta (mínimo 3 caracteres)");
              return;
            }
            if (clinical.hasDiabetes && !clinical.diabetesDetails.trim()) {
              setError("Indica detalles de diabetes");
              return;
            }
            if (clinical.hasHypertension && !clinical.hypertensionDetails.trim()) {
              setError("Indica detalles de hipertensión");
              return;
            }
            if (clinical.hasHeartDisease && !clinical.heartDiseaseDetails.trim()) {
              setError("Indica detalles cardíacos");
              return;
            }
            if (clinical.hasAllergies && !clinical.allergyDetails.trim()) {
              setError("Indica las alergias");
              return;
            }
            if (clinical.hasSurgeries && !clinical.surgeryDetails.trim()) {
              setError("Indica las cirugías previas");
              return;
            }
            setError(null);
            goNext();
          }}
        />
      )}

      {step === 5 && (
        <section className={cardClassName}>
          <h2 className="text-lg font-medium text-slate-900">Consentimiento informado</h2>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            {STATION_CONSENT_TEXT}
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelClassName}>Nombre completo del paciente o tutor *</label>
              <input
                value={consentSignerName}
                onChange={(e) => setConsentSignerName(e.target.value)}
                className={inputClassName}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
              />
              He leído y acepto el consentimiento informado
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={goBack} className="text-sm text-slate-600">
              ← Atrás
            </button>
            <button
              type="button"
              disabled={pending || !consentAccepted || consentSignerName.trim().length < 3}
              onClick={handleConsentSubmit}
              className={buttonPrimaryClassName}
            >
              {pending ? "Guardando…" : "Aceptar y continuar"}
            </button>
          </div>
        </section>
      )}

      {step === 6 && displayAppointment && patient && (
        <section className={cardClassName}>
          <h2 className="text-lg font-medium text-slate-900">Toma de signos vitales</h2>
          <p className="mt-2 text-sm text-slate-600">
            El personal de enfermería registrará tus signos. Sigue estas instrucciones:
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {STATION_VITALS_INSTRUCTIONS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {hasVitals ? (
            <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              Signos vitales registrados. Puedes continuar a la sala de espera.
            </p>
          ) : (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Aún no hay signos vitales para esta cita. Captúralos antes de pasar a espera.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/triage/nuevo?patientId=${patient.id}&appointmentId=${appointmentId}&redirect=${encodeURIComponent(`/estacion/flujo?paso=7&cita=${appointmentId}`)}`}
              className={buttonPrimaryClassName}
            >
              Ir a captura de signos
            </Link>
            {hasVitals ? (
              <button type="button" onClick={goNext} className="text-sm text-teal-700 hover:underline">
                Continuar a sala de espera →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setHasVitals(true)}
                className="text-sm text-slate-600 hover:underline"
              >
                Ya capturé signos (confirmar manualmente)
              </button>
            )}
            <button type="button" onClick={goBack} className="text-sm text-slate-600">
              ← Atrás
            </button>
          </div>
        </section>
      )}

      {step === 7 && displayAppointment && (
        <section className={`${cardClassName} text-center`}>
          <p className="text-xs font-medium uppercase text-teal-600">Listo</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Sala de espera — teleconsulta</h2>
          <p className="mt-3 text-sm text-slate-600">
            {patient?.name}, tu consulta con <strong>Dr(a). {displayAppointment.doctorName}</strong> está
            programada para{" "}
            <strong>
              {new Date(displayAppointment.startAt).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>
            .
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Permanece en la sala de espera. El médico te llamará para iniciar la videollamada.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/agenda/${appointmentId}`} className={buttonPrimaryClassName}>
              Ver detalle de cita
            </Link>
            <Link
              href="/estacion/flujo"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Atender otro paciente
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function DataConfirmPanel({
  patient,
  dataConfirmed,
  onConfirmChange,
}: {
  patient: PatientSummary;
  dataConfirmed: boolean;
  onConfirmChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50 p-4">
      <h3 className="font-medium text-slate-900">Datos del paciente</h3>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Nombre</dt>
          <dd>{patient.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Expediente</dt>
          <dd>{patient.chartNumber}</dd>
        </div>
        {patient.birthDate && (
          <div>
            <dt className="text-slate-500">Fecha de nacimiento</dt>
            <dd>{patient.birthDate}</dd>
          </div>
        )}
        {patient.sex && (
          <div>
            <dt className="text-slate-500">Sexo</dt>
            <dd>{patient.sex}</dd>
          </div>
        )}
        {patient.phone && (
          <div>
            <dt className="text-slate-500">Teléfono</dt>
            <dd>{patient.phone}</dd>
          </div>
        )}
      </dl>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={dataConfirmed}
          onChange={(e) => onConfirmChange(e.target.checked)}
        />
        Confirmo que los datos son correctos
      </label>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-1">
      {STEPS.map((label, index) => {
        const n = index + 1;
        const active = n === current;
        const done = n < current;
        return (
          <li
            key={label}
            className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${
              active
                ? "bg-teal-700 text-white"
                : done
                  ? "bg-teal-100 text-teal-800"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {n}. {label}
          </li>
        );
      })}
    </ol>
  );
}

function ChoiceCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 p-5 text-left hover:border-teal-300 hover:bg-teal-50/50"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </button>
  );
}

function ClinicalStep({
  clinical,
  setClinical,
  onBack,
  onNext,
}: {
  clinical: ClinicalState;
  setClinical: React.Dispatch<React.SetStateAction<ClinicalState>>;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className={cardClassName}>
      <h2 className="text-lg font-medium text-slate-900">Formulario clínico inicial</h2>
      <div className="mt-4 space-y-5">
        <div>
          <label className={labelClassName}>Motivo de consulta hoy *</label>
          <textarea
            rows={2}
            value={clinical.chiefComplaint}
            onChange={(e) => setClinical({ ...clinical, chiefComplaint: e.target.value })}
            className={textareaClassName}
          />
        </div>
        <YesNoBlock
          label="¿Diabetes?"
          checked={clinical.hasDiabetes}
          onChange={(v) => setClinical({ ...clinical, hasDiabetes: v })}
          detail={clinical.diabetesDetails}
          onDetail={(v) => setClinical({ ...clinical, diabetesDetails: v })}
          placeholder="Tipo, medicamento, control…"
        />
        <YesNoBlock
          label="¿Hipertensión?"
          checked={clinical.hasHypertension}
          onChange={(v) => setClinical({ ...clinical, hasHypertension: v })}
          detail={clinical.hypertensionDetails}
          onDetail={(v) => setClinical({ ...clinical, hypertensionDetails: v })}
          placeholder="Medicamento, última PA…"
        />
        <YesNoBlock
          label="¿Enfermedad cardíaca?"
          checked={clinical.hasHeartDisease}
          onChange={(v) => setClinical({ ...clinical, hasHeartDisease: v })}
          detail={clinical.heartDiseaseDetails}
          onDetail={(v) => setClinical({ ...clinical, heartDiseaseDetails: v })}
          placeholder="Diagnóstico, tratamiento…"
        />
        <YesNoDetailList
          label="¿Alergias?"
          checked={clinical.hasAllergies}
          onCheckedChange={(v) => setClinical({ ...clinical, hasAllergies: v })}
          value={clinical.allergyDetails}
          onChange={(v) => setClinical({ ...clinical, allergyDetails: v })}
          placeholder="Sustancia y reacción…"
          addLabel="Agregar otra alergia"
        />
        <YesNoDetailList
          label="¿Cirugías previas?"
          checked={clinical.hasSurgeries}
          onCheckedChange={(v) => setClinical({ ...clinical, hasSurgeries: v })}
          value={clinical.surgeryDetails}
          onChange={(v) => setClinical({ ...clinical, surgeryDetails: v })}
          placeholder="Procedimiento y año…"
          addLabel="Agregar otra cirugía"
        />
        <div>
          <label className={labelClassName}>Otras enfermedades crónicas</label>
          <textarea
            rows={2}
            value={clinical.otherChronicConditions}
            onChange={(e) => setClinical({ ...clinical, otherChronicConditions: e.target.value })}
            className={textareaClassName}
          />
        </div>
        <div>
          <label className={labelClassName}>Medicamentos actuales</label>
          <textarea
            rows={2}
            value={clinical.currentMedications}
            onChange={(e) => setClinical({ ...clinical, currentMedications: e.target.value })}
            className={textareaClassName}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Tabaco</label>
            <select
              value={clinical.smokingStatus}
              onChange={(e) =>
                setClinical({ ...clinical, smokingStatus: e.target.value as SmokingStatus })
              }
              className={selectClassName}
            >
              {(Object.entries(SMOKING_STATUS_LABELS) as [SmokingStatus, string][]).map(
                ([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Alcohol</label>
            <select
              value={clinical.alcoholUse}
              onChange={(e) =>
                setClinical({ ...clinical, alcoholUse: e.target.value as AlcoholUseLevel })
              }
              className={selectClassName}
            >
              {(Object.entries(ALCOHOL_USE_LABELS) as [AlcoholUseLevel, string][]).map(
                ([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onBack} className="text-sm text-slate-600">
          ← Atrás
        </button>
        <button type="button" onClick={onNext} className={buttonPrimaryClassName}>
          Continuar
        </button>
      </div>
    </section>
  );
}

function YesNoBlock({
  label,
  checked,
  onChange,
  detail,
  onDetail,
  placeholder,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  detail: string;
  onDetail: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <p className={labelClassName}>{label}</p>
      <div className="mt-2 flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!checked} onChange={() => onChange(false)} />
          No
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={checked} onChange={() => onChange(true)} />
          Sí
        </label>
      </div>
      {checked && (
        <input
          value={detail}
          onChange={(e) => onDetail(e.target.value)}
          placeholder={placeholder}
          className={`${inputClassName} mt-3`}
        />
      )}
    </div>
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
      <input name={name} type={type} required={required} className={inputClassName} />
    </div>
  );
}
