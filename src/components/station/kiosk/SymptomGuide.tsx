"use client";

import type { ReactNode } from "react";
import {
  DURATION_OPTIONS,
  INTENSITY_OPTIONS,
  PAIN_LOCATION_OPTIONS,
  SYMPTOM_PRIMARY_OPTIONS,
  buildChiefComplaintFromSelection,
  detectSymptomRedFlags,
  getIncompleteSymptomDetailKeys,
  needsPainLocation,
  type PainLocationCode,
  type SymptomDetail,
  type SymptomDuration,
  type SymptomIntensity,
  type SymptomPrimaryCode,
  type SymptomSelection,
} from "@/lib/kiosk/symptom-catalog";
import { BodyPainMap } from "./BodyPainMap";
import { kioskTextFieldProps } from "./KioskOnScreenKeyboard";
import {
  KioskImportant,
  kioskChipClassName,
  kioskHelperClassName,
  kioskInputClassName,
} from "./KioskTheme";

const SYMPTOM_ICONS: Record<SymptomPrimaryCode, string> = {
  dolor: "📍",
  ardor: "🔥",
  dolor_cabeza: "🤕",
  dolor_muscular: "💪",
  dolor_garganta: "🗣️",
  fiebre: "🌡️",
  tos: "😷",
  congestion: "🤧",
  dificultad_respiratoria: "😮‍💨",
  mareo: "😵",
  desmayo: "⛔",
  debilidad: "⚠️",
  entumecimiento: "🖐️",
  confusion: "🧩",
  dificultad_hablar: "💬",
  nausea: "🤢",
  diarrea: "🚽",
  estrenimiento: "😣",
  fatiga: "😴",
  palpitaciones: "💓",
  sintomas_urinarios: "🚻",
  oido: "👂",
  ojo_rojo: "👁️",
  erupcion_piel: "🩹",
  reaccion_alergica: "🚨",
  hinchazon: "🫧",
  ansiedad: "😰",
  otro: "➕",
};
function toggleInList<T extends string>(list: T[], code: T): T[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
}

function ChipButton({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${kioskChipClassName} transition ${
        active
          ? danger
            ? "bg-amber-600 text-white shadow-sm"
            : "bg-[#1d6eb8] text-white shadow-sm"
          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function DetailPicker({
  title,
  detail,
  onChange,
  highlightIncomplete,
}: {
  title: string;
  detail?: SymptomDetail;
  onChange: (next: SymptomDetail) => void;
  highlightIncomplete?: boolean;
}) {
  const missingIntensity = highlightIncomplete && !detail?.intensity;
  const missingDuration = highlightIncomplete && !detail?.duration;
  const incomplete = missingIntensity || missingDuration;

  return (
    <div
      className={`rounded-lg border-2 border-l-4 bg-white p-3 ${
        incomplete
          ? "border-red-300 border-l-red-500"
          : "border-slate-200 border-l-[#1d6eb8]"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-bold text-slate-900 xl:text-xl">{title}</p>
        {incomplete ? (
          <p className="text-base font-semibold text-red-700">Complete Intensidad y Desde cuándo</p>
        ) : null}
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p
            className={`text-base font-semibold xl:text-lg ${
              missingIntensity ? "text-red-700" : "text-slate-600"
            }`}
          >
            Intensidad *{missingIntensity ? " (obligatorio)" : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {INTENSITY_OPTIONS.map((opt) => (
              <ChipButton
                key={opt.code}
                active={detail?.intensity === opt.code}
                onClick={() =>
                  onChange({
                    ...detail,
                    intensity:
                      detail?.intensity === opt.code
                        ? undefined
                        : (opt.code as SymptomIntensity),
                  })
                }
              >
                {opt.label}
              </ChipButton>
            ))}
          </div>
        </div>
        <div>
          <p
            className={`text-base font-semibold xl:text-lg ${
              missingDuration ? "text-red-700" : "text-slate-600"
            }`}
          >
            ¿Desde cuándo? *{missingDuration ? " (obligatorio)" : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DURATION_OPTIONS.map((opt) => (
              <ChipButton
                key={opt.code}
                active={detail?.duration === opt.code}
                onClick={() =>
                  onChange({
                    ...detail,
                    duration:
                      detail?.duration === opt.code
                        ? undefined
                        : (opt.code as SymptomDuration),
                  })
                }
              >
                {opt.label}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SymptomGuide({
  value,
  onChange,
  highlightIncomplete = false,
}: {
  value: SymptomSelection;
  onChange: (next: SymptomSelection) => void;
  highlightIncomplete?: boolean;
}) {
  const redFlags = detectSymptomRedFlags(value);
  const preview = buildChiefComplaintFromSelection(value);
  const incompleteKeys = highlightIncomplete
    ? getIncompleteSymptomDetailKeys(value)
    : new Set<string>();

  function setPrimary(code: SymptomPrimaryCode) {
    const primary = toggleInList(value.primary, code);
    const symptomDetails = { ...value.symptomDetails };
    let painLocations = value.painLocations;
    let painDetails = { ...value.painDetails };
    let otherText = value.otherText;

    if (!primary.includes(code)) {
      delete symptomDetails[code];
    } else if (code !== "dolor" && code !== "ardor" && !symptomDetails[code]) {
      symptomDetails[code] = {};
    }

    if (!primary.includes("dolor") && !primary.includes("ardor")) {
      painLocations = [];
      painDetails = {};
    }
    if (!primary.includes("otro")) {
      otherText = "";
      delete symptomDetails.otro;
    }

    onChange({ ...value, primary, symptomDetails, painLocations, painDetails, otherText });
  }

  function setPainLocation(code: PainLocationCode) {
    const painLocations = toggleInList(value.painLocations, code);
    const painDetails = { ...value.painDetails };
    if (!painLocations.includes(code)) delete painDetails[code];
    else if (!painDetails[code]) painDetails[code] = {};
    onChange({ ...value, painLocations, painDetails });
  }

  const detailTargets: Array<{
    key: string;
    title: string;
    kind: "symptom" | "pain";
    code: string;
  }> = [];

  if (needsPainLocation(value)) {
    const hasDolor = value.primary.includes("dolor");
    const hasArdor = value.primary.includes("ardor");
    const sense =
      hasDolor && hasArdor ? "Dolor / Ardor" : hasArdor ? "Ardor" : "Dolor";
    for (const loc of value.painLocations) {
      const opt = PAIN_LOCATION_OPTIONS.find((o) => o.code === loc);
      detailTargets.push({
        key: `pain-${loc}`,
        title: `${sense} · ${opt?.label ?? loc}`,
        kind: "pain",
        code: loc,
      });
    }
  }

  for (const code of value.primary) {
    if (code === "dolor" || code === "ardor") continue;
    const opt = SYMPTOM_PRIMARY_OPTIONS.find((o) => o.code === code);
    detailTargets.push({
      key: `symptom-${code}`,
      title: opt?.label ?? code,
      kind: "symptom",
      code,
    });
  }

  return (
    <div className="space-y-4">
      <div
        role="note"
        className="rounded-2xl border-4 border-amber-500 bg-amber-100 px-4 py-4 shadow-sm sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-600 bg-amber-500 px-3 py-1.5 text-base font-black uppercase tracking-wide text-white"
            aria-hidden
          >
            <span className="h-4 w-4 rounded-sm bg-amber-200 ring-2 ring-white" />
            Ámbar = alerta
          </span>
          <p className="text-xl font-black leading-snug text-amber-950 xl:text-2xl">
            Las tarjetas en color ámbar son síntomas de alerta o críticos
          </p>
        </div>
        <p className="mt-2 text-lg font-semibold leading-snug text-amber-950 xl:text-xl">
          Si marca uno de ellos, el sistema priorizará valoración urgente y, si es necesario,
          lo enlazará directamente a teleconsulta con un médico (sin receta automática).
        </p>
      </div>

      <section className="rounded-xl border-2 border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-xl font-bold text-slate-900 xl:text-2xl">1 · ¿Qué siente?</h3>
        <p className={`mt-1 mb-3 ${kioskHelperClassName}`}>
          Toque las tarjetas grandes. Puede elegir varias. Azul = habitual · Ámbar = alerta.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {SYMPTOM_PRIMARY_OPTIONS.map((opt) => {
            const active = value.primary.includes(opt.code);
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setPrimary(opt.code)}
                className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition active:scale-[0.98] ${
                  active
                    ? opt.redFlag
                      ? "border-amber-600 bg-amber-500 text-white shadow-md"
                      : "border-[#1d6eb8] bg-[#1d6eb8] text-white shadow-md"
                    : opt.redFlag
                      ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                      : "border-slate-200 bg-slate-50 text-slate-900 hover:border-[#1d6eb8]/40 hover:bg-[#f0f7ff]"
                }`}
              >
                <span className="text-3xl" aria-hidden>
                  {SYMPTOM_ICONS[opt.code] ?? "•"}
                </span>
                <span className="text-base font-bold leading-tight xl:text-lg">{opt.label}</span>
                {opt.redFlag ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide xl:text-xs ${
                      active ? "bg-white/25 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    Alerta
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {needsPainLocation(value) && (
        <section className="rounded-xl border-2 border-[#1d6eb8]/40 bg-[#f7fbff] p-4 sm:p-5">
          <h3 className="text-xl font-bold text-slate-900 xl:text-2xl">
            2 · ¿Dónde lo siente? Toque la zona del cuerpo
          </h3>
          <p className={`mt-1 mb-3 ${kioskHelperClassName}`}>
            Marque una o varias zonas. Luego complete intensidad y duración abajo.
          </p>
          <BodyPainMap selected={value.painLocations} onToggle={setPainLocation} />
        </section>
      )}

      {value.primary.includes("otro") && (
        <section className="rounded-xl border-2 border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-xl font-bold text-slate-900 xl:text-2xl">Describa el otro síntoma</h3>
          <input
            value={value.otherText ?? ""}
            onChange={(e) => onChange({ ...value, otherText: e.target.value })}
            {...kioskTextFieldProps}
            className={`mt-3 ${kioskInputClassName}`}
            placeholder="Ej. comezón, inflamación…"
          />
        </section>
      )}

      {detailTargets.length > 0 && (
        <section className="rounded-xl border-2 border-[#1d6eb8]/50 bg-[#f7fbff] p-4 sm:p-5">
          <h3 className="text-xl font-bold text-slate-900 xl:text-2xl">
            3 · Intensidad y duración
          </h3>
          <p className={`mt-1 mb-3 ${kioskHelperClassName}`}>
            Complete cada síntoma o zona que marcó.
          </p>
          <div id="symptom-detail-section" className="space-y-2.5">
            {detailTargets.map((target) => (
              <DetailPicker
                key={target.key}
                title={target.title}
                highlightIncomplete={incompleteKeys.has(target.key)}
                detail={
                  target.kind === "pain"
                    ? value.painDetails[target.code as PainLocationCode]
                    : value.symptomDetails[target.code as SymptomPrimaryCode]
                }
                onChange={(detail) => {
                  if (target.kind === "pain") {
                    onChange({
                      ...value,
                      painDetails: {
                        ...value.painDetails,
                        [target.code]: detail,
                      },
                    });
                  } else {
                    onChange({
                      ...value,
                      symptomDetails: {
                        ...value.symptomDetails,
                        [target.code]: detail,
                      },
                    });
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {redFlags.length > 0 && (
        <KioskImportant title="Se detectó un posible signo de alarma">
          <ul className="mt-1 list-disc pl-5 text-lg xl:text-xl">
            {redFlags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-lg xl:text-xl">
            Puede continuar el cuestionario. Con estos signos el sistema{" "}
            <strong>no emitirá receta automática</strong> y priorizará teleconsulta o
            valoración urgente.
          </p>
        </KioskImportant>
      )}

      {preview ? (
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-lg text-slate-700 xl:text-xl">
          <span className="font-semibold text-slate-900">Resumen: </span>
          {preview}
        </div>
      ) : null}
    </div>
  );
}
