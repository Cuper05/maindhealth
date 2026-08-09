"use client";

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
import { kioskTextFieldProps } from "./KioskOnScreenKeyboard";

function toggleInList<T extends string>(list: T[], code: T): T[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
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
      className={`rounded-xl border bg-slate-50/80 p-4 ${
        incomplete ? "border-red-300 ring-1 ring-red-200" : "border-slate-100"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {incomplete && (
          <p className="text-xs font-medium text-red-700">Completa Intensidad y Desde cuándo</p>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className={`text-xs font-medium ${missingIntensity ? "text-red-700" : "text-slate-600"}`}>
            Intensidad *{missingIntensity ? " (obligatorio)" : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() =>
                  onChange({
                    ...detail,
                    intensity: detail?.intensity === opt.code ? undefined : (opt.code as SymptomIntensity),
                  })
                }
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium ${
                  detail?.intensity === opt.code
                    ? "bg-slate-800 text-white"
                    : missingIntensity
                      ? "bg-white text-slate-600 ring-1 ring-red-300"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={`text-xs font-medium ${missingDuration ? "text-red-700" : "text-slate-600"}`}>
            ¿Desde cuándo? *{missingDuration ? " (obligatorio)" : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() =>
                  onChange({
                    ...detail,
                    duration: detail?.duration === opt.code ? undefined : (opt.code as SymptomDuration),
                  })
                }
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium ${
                  detail?.duration === opt.code
                    ? "bg-slate-800 text-white"
                    : missingDuration
                      ? "bg-white text-slate-600 ring-1 ring-red-300"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {opt.label}
              </button>
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
  /** Resalta campos de detalle incompletos tras intentar Continuar. */
  highlightIncomplete?: boolean;
}) {
  const redFlags = detectSymptomRedFlags(value);
  const preview = buildChiefComplaintFromSelection(value);
  const incompleteKeys = highlightIncomplete ? getIncompleteSymptomDetailKeys(value) : new Set<string>();

  function setPrimary(code: SymptomPrimaryCode) {
    const primary = toggleInList(value.primary, code);
    const symptomDetails = { ...value.symptomDetails };
    let painLocations = value.painLocations;
    let painDetails = { ...value.painDetails };
    let otherText = value.otherText;

    if (!primary.includes(code)) {
      delete symptomDetails[code];
    } else if (code !== "dolor" && !symptomDetails[code]) {
      symptomDetails[code] = {};
    }

    if (!primary.includes("dolor")) {
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

  const detailTargets: Array<{ key: string; title: string; kind: "symptom" | "pain"; code: string }> = [];

  if (value.primary.includes("dolor")) {
    for (const loc of value.painLocations) {
      const opt = PAIN_LOCATION_OPTIONS.find((o) => o.code === loc);
      detailTargets.push({
        key: `pain-${loc}`,
        title: `Dolor · ${opt?.label ?? loc}`,
        kind: "pain",
        code: loc,
      });
    }
  }

  for (const code of value.primary) {
    if (code === "dolor") continue;
    const opt = SYMPTOM_PRIMARY_OPTIONS.find((o) => o.code === code);
    detailTargets.push({
      key: `symptom-${code}`,
      title: opt?.label ?? code,
      kind: "symptom",
      code,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700">¿Qué sientes hoy? *</p>
        <p className="mt-1 text-xs text-slate-500">Puedes seleccionar una o varias opciones.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SYMPTOM_PRIMARY_OPTIONS.map((opt) => {
            const active = value.primary.includes(opt.code);
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setPrimary(opt.code)}
                className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? opt.redFlag
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-[#1d6eb8] text-white shadow-sm"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {needsPainLocation(value) && (
        <div>
          <p className="text-sm font-medium text-slate-700">¿Dónde duele? *</p>
          <p className="mt-1 text-xs text-slate-500">
            Selecciona la zona o zonas. Luego indica intensidad y duración de cada una.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAIN_LOCATION_OPTIONS.map((opt) => {
              const active = value.painLocations.includes(opt.code);
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setPainLocation(opt.code)}
                  className={`min-h-[48px] rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? opt.redFlag
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-[#1d6eb8] text-white shadow-sm"
                      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.primary.includes("otro") && (
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Describe el otro síntoma *</label>
          <input
            value={value.otherText ?? ""}
            onChange={(e) => onChange({ ...value, otherText: e.target.value })}
            {...kioskTextFieldProps}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-[#1d6eb8] focus:outline-none focus:ring-2 focus:ring-[#1d6eb8]/20"
            placeholder="Ej. comezón, inflamación…"
          />
        </div>
      )}

      {detailTargets.length > 0 && (
        <div id="symptom-detail-section" className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Detalle de cada síntoma</p>
          <p className="text-xs text-slate-500">
            Completa intensidad y duración por separado para cada síntoma seleccionado.
          </p>
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
      )}

      {redFlags.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Se detectó un posible signo de alarma</p>
          <ul className="mt-1 list-disc pl-5">
            {redFlags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Podrás continuar; el sistema priorizará evaluación médica si corresponde.
          </p>
        </div>
      )}

      {preview && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Resumen: </span>
          {preview}
        </div>
      )}
    </div>
  );
}
