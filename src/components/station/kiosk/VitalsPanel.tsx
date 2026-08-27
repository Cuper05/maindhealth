import type { VitalsDraft } from "./kiosk-api";
import {
  bandTone,
  interpretBmi,
  interpretBloodPressure,
  interpretEcg,
  interpretHeartRate,
  interpretHeight,
  interpretSpo2,
  interpretTemperature,
  interpretWeight,
  VITAL_RANGE_COPY,
  type VitalReadingView,
} from "@/lib/kiosk/vital-ranges";

type Row = {
  id: string;
  label: string;
  value: string | null;
  icon: string;
  view: VitalReadingView | null;
};

function buildRows(draft: VitalsDraft): Row[] {
  const bp = interpretBloodPressure(draft.systolicPressure, draft.diastolicPressure);
  const hr = interpretHeartRate(draft.heartRate);
  const spo2 = interpretSpo2(draft.oxygenSaturation);
  const temp = interpretTemperature(draft.temperature);
  const bmi = interpretBmi(draft.bmi);
  const weight = interpretWeight(draft.weight);
  const height = interpretHeight(draft.height);
  const ecg = interpretEcg(draft.ecgStatus, draft.ecgRhythm);

  return [
    {
      id: "weight",
      label: "Peso",
      value: weight?.valueText ?? null,
      icon: "📟",
      view: weight,
    },
    {
      id: "height",
      label: "Altura",
      value: height?.valueText ?? null,
      icon: "📏",
      view: height,
    },
    {
      id: "bmi",
      label: "IMC",
      value: bmi?.valueText ?? null,
      icon: "📊",
      view: bmi,
    },
    {
      id: "pressure",
      label: "Presión",
      value: bp?.valueText ?? null,
      icon: "🫀",
      view: bp,
    },
    {
      id: "heartRate",
      label: "Pulso",
      value: hr?.valueText ?? null,
      icon: "💓",
      view: hr,
    },
    {
      id: "spo2",
      label: "SpO₂",
      value: spo2?.valueText ?? null,
      icon: "🫁",
      view: spo2,
    },
    {
      id: "temperature",
      label: "Temp.",
      value: temp?.valueText ?? null,
      icon: "🌡️",
      view: temp,
    },
    {
      id: "ecg",
      label: "ECG",
      value: ecg?.valueText ?? null,
      icon: "📈",
      view: ecg,
    },
  ];
}

function rowShellClass(view: VitalReadingView | null, done: boolean): string {
  if (!done) return "bg-slate-50/60";
  if (!view) return "bg-emerald-50/90";
  if (view.band === "normal") return "border border-emerald-200 bg-emerald-50/90";
  if (view.band === "low" || view.band === "high") return "border border-amber-300 bg-amber-50/90";
  return "border border-[#1d6eb8]/20 bg-[#f0f7ff]";
}

/** Barra lateral: tipografía legible; scroll si no caben todas las filas. */
export function VitalsPanel({ draft }: { draft: VitalsDraft }) {
  const rows = buildRows(draft);
  const completed = rows.filter((r) => r.value).length;

  return (
    <aside className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-[#1a4d7c] to-[#1d6eb8] px-3 py-3">
        <h3 className="text-lg font-bold text-white xl:text-xl">Tus resultados</h3>
        <p className="text-base text-blue-100">
          {completed}/{rows.length} listas
        </p>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
        {rows.map((row) => {
          const done = Boolean(row.value);
          return (
            <li key={row.id} className={`rounded-lg px-2.5 py-2 ${rowShellClass(row.view, done)}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl leading-none" aria-hidden>
                  {row.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-500 xl:text-base">
                    {row.label}
                  </p>
                  <p
                    className={`truncate text-base font-semibold xl:text-lg ${
                      done ? "text-slate-900" : "text-slate-300"
                    }`}
                  >
                    {row.value ?? "—"}
                  </p>
                </div>
                {done ? (
                  <span className="text-sm font-bold text-emerald-600">✓</span>
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                )}
              </div>
              {done && row.view ? (
                <p className="mt-1 pl-8 text-xs font-semibold leading-snug text-slate-600 xl:text-sm">
                  {row.view.verdict}
                  {row.view.normalRange ? ` · Normal: ${row.view.normalRange}` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="shrink-0 border-t border-slate-100 px-2.5 py-2 text-[11px] leading-snug text-slate-500 xl:text-xs">
        {VITAL_RANGE_COPY.disclaimer}
      </p>
    </aside>
  );
}

/** Resumen en la tarjeta principal: legible en kiosco, con rango e interpretación. */
export function VitalsSummaryGrid({ draft }: { draft: VitalsDraft }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {buildRows(draft).map((row) => {
          const tone = row.view ? bandTone(row.view.band) : null;
          return (
            <div
              key={row.id}
              className={`flex flex-col justify-center rounded-2xl border-2 px-4 py-4 xl:px-5 xl:py-5 ${
                row.value && tone
                  ? tone.box
                  : row.value
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 xl:text-base">
                <span className="mr-1.5 text-lg xl:text-xl" aria-hidden>
                  {row.icon}
                </span>
                {row.label}
              </p>
              <p
                className={`mt-2 break-words text-2xl font-bold leading-tight tabular-nums xl:text-3xl ${
                  row.value ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {row.value ?? "—"}
              </p>
              {row.view ? (
                <>
                  <p className="mt-2 text-sm font-medium text-slate-600 xl:text-base">
                    Normal: {row.view.normalRange}
                  </p>
                  <span
                    className={`mt-2 inline-flex w-fit rounded-lg px-2 py-1 text-sm font-bold xl:text-base ${tone?.badge ?? "bg-slate-500 text-white"}`}
                  >
                    {row.view.verdict}
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-center text-base font-medium text-slate-600 xl:text-lg">
        {VITAL_RANGE_COPY.disclaimer}
      </p>
    </div>
  );
}
