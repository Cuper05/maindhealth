"use client";

import type { VitalBand, VitalReadingView } from "@/lib/kiosk/vital-ranges";
import { bandTone, VITAL_RANGE_COPY } from "@/lib/kiosk/vital-ranges";
import { VitalIllustration, type VitalIllustrationType } from "./KioskIllustrations";
import {
  KioskCard,
  KioskImportant,
  KioskPrimaryButton,
  KioskSecondaryButton,
  StatusPill,
  kioskHelperClassName,
  kioskSubtitleClassName,
  kioskTitleClassName,
} from "./KioskTheme";

function ReadingVerdict({ views }: { views: VitalReadingView[] }) {
  if (views.length === 0) return null;
  const worst: VitalBand = views.some((v) => v.band === "high" || v.band === "low")
    ? "high"
    : views.every((v) => v.band === "normal")
      ? "normal"
      : "info";
  const tone = bandTone(worst);

  return (
    <div className={`shrink-0 space-y-2 rounded-2xl border-2 px-4 py-3 xl:py-4 ${tone.box}`}>
      <div className="grid grid-cols-2 gap-3 text-center">
        {views.map((view) => {
          const t = bandTone(view.band);
          return (
            <div key={view.label} className={views.length === 1 ? "col-span-2" : undefined}>
              <p className="text-base font-semibold uppercase tracking-wide text-slate-600 xl:text-lg">
                {view.label}
              </p>
              <p className={`mt-1 text-4xl font-bold tabular-nums xl:text-5xl ${t.value}`}>
                {view.valueText}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-600 xl:text-base">
                Normal: {view.normalRange}
              </p>
              <span
                className={`mt-2 inline-block rounded-lg px-2.5 py-1 text-sm font-bold xl:text-base ${t.badge}`}
              >
                {view.verdict}
              </span>
            </div>
          );
        })}
      </div>
      <p className={`text-center font-medium text-slate-700 ${kioskHelperClassName}`}>
        {VITAL_RANGE_COPY.disclaimer}
      </p>
    </div>
  );
}

export function VitalStepScreen({
  stepNumber,
  totalSteps,
  title,
  instruction,
  steps,
  tips,
  illustration,
  deviceStatus,
  statusMessage,
  /** Lectura real grande (p. ej. SpO₂ / FC). Nunca valores de ejemplo. */
  readingHighlight,
  /** Interpretación + rango normal (preferido sobre readingHighlight solo). */
  readingViews,
  /** Rangos de referencia visibles mientras espera la lectura. */
  referenceRanges,
  /** Texto bajo los valores grandes (legacy si no hay readingViews). */
  readingNote = "Lectura recibida del dispositivo — estos son sus valores reales",
  onContinue,
  onSimulate,
  onBack,
  onRetry,
  onCapture,
  captureLabel = "Leer dispositivo",
  capturingLabel = "Leyendo…",
  captureHelp,
  captureOptional = false,
  capturing = false,
  /**
   * Layout de una sola pantalla: instrucciones en 2 columnas + botones grandes
   * aprovechando todo el alto disponible (sin achicar el tacto).
   */
  compact = false,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  instruction: string;
  steps?: string[];
  tips?: string[];
  illustration: VitalIllustrationType;
  deviceStatus: "idle" | "waiting" | "reading" | "done" | "retry";
  statusMessage?: string;
  readingHighlight?: {
    primary: string;
    primaryLabel: string;
    secondary?: string;
    secondaryLabel?: string;
  };
  readingViews?: VitalReadingView[];
  referenceRanges?: string[];
  readingNote?: string;
  onContinue: () => void;
  onSimulate: () => void;
  onBack?: () => void;
  onRetry?: () => void;
  onCapture?: () => void;
  captureLabel?: string;
  capturingLabel?: string;
  captureHelp?: string;
  captureOptional?: boolean;
  capturing?: boolean;
  compact?: boolean;
}) {
  const showCapture = Boolean(onCapture) && deviceStatus !== "done";
  const continueBlocked =
    capturing || (Boolean(onCapture) && !captureOptional && deviceStatus !== "done");
  const showReading =
    deviceStatus === "done" &&
    !capturing &&
    (Boolean(readingViews?.length) || Boolean(readingHighlight));

  return (
    <KioskCard
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        compact ? "!p-4 sm:!p-5" : ""
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold uppercase tracking-wide text-[#1d6eb8] xl:text-lg">
            Paso {stepNumber} de {totalSteps}
          </p>
          <h2 className={`mt-0.5 ${kioskTitleClassName}`}>{title}</h2>
        </div>
        <StatusPill status={capturing ? "reading" : deviceStatus} />
      </div>

      {instruction ? (
        <p className={`w-full shrink-0 ${kioskSubtitleClassName}`}>{instruction}</p>
      ) : null}

      {referenceRanges && referenceRanges.length > 0 && !showReading ? (
        <div className="mt-2 shrink-0 rounded-xl border-2 border-[#1d6eb8]/25 bg-[#f0f7ff] px-3 py-2.5">
          <p className="text-sm font-bold uppercase tracking-wide text-[#0b4f8a] xl:text-base">
            Rango normal de referencia
          </p>
          <ul className="mt-1 space-y-0.5">
            {referenceRanges.map((line) => (
              <li key={line} className="text-base font-semibold text-slate-800 xl:text-lg">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {showCapture ? (
          <div className="shrink-0 rounded-2xl border-2 border-teal-600 bg-teal-50 p-3 xl:p-4">
            <p className="mb-2 text-center text-xl font-bold text-teal-900 xl:text-2xl">
              Para iniciar, toque el botón verde
            </p>
            <button
              type="button"
              onClick={onCapture}
              disabled={capturing}
              className="flex w-full min-h-[72px] items-center justify-center rounded-2xl bg-teal-700 px-6 text-2xl font-bold text-white shadow-md transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60 xl:min-h-[84px] xl:text-3xl"
            >
              {capturing ? capturingLabel : captureLabel}
            </button>
            {captureHelp && !compact ? (
              <p className={`mt-2 text-center ${kioskHelperClassName}`}>{captureHelp}</p>
            ) : null}
            {statusMessage && !showReading ? (
              <p className={`mt-2 text-center font-medium text-teal-800 ${kioskHelperClassName}`}>
                {statusMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {showReading && readingViews && readingViews.length > 0 ? (
          <ReadingVerdict views={readingViews} />
        ) : null}

        {showReading && (!readingViews || readingViews.length === 0) && readingHighlight ? (
          <div className="shrink-0 grid grid-cols-2 gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center xl:py-4">
            <div>
              <p className="text-base font-semibold uppercase tracking-wide text-emerald-800 xl:text-lg">
                {readingHighlight.primaryLabel}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-emerald-950 xl:text-5xl">
                {readingHighlight.primary}
              </p>
            </div>
            {readingHighlight.secondary != null ? (
              <div>
                <p className="text-base font-semibold uppercase tracking-wide text-emerald-800 xl:text-lg">
                  {readingHighlight.secondaryLabel ?? "Pulso"}
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-emerald-950 xl:text-5xl">
                  {readingHighlight.secondary}
                </p>
              </div>
            ) : null}
            <p className={`col-span-2 font-medium text-emerald-800 ${kioskHelperClassName}`}>
              {readingNote}
            </p>
          </div>
        ) : null}

        <div
          className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${
            compact
              ? "grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]"
              : "grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]"
          }`}
        >
          <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
            {steps && steps.length > 0 ? (
              <ol
                className={`grid min-h-0 flex-1 content-stretch gap-2 ${
                  compact ? "grid-cols-1 sm:grid-cols-2 auto-rows-fr" : "grid-cols-1"
                }`}
              >
                {steps.map((item, index) => (
                  <li
                    key={item}
                    className="flex min-h-0 items-start gap-3 rounded-2xl border-2 border-[#1d6eb8]/20 bg-[#f0f7ff] px-3 py-3 text-lg text-slate-800 xl:px-4 xl:py-3.5 xl:text-xl"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1d6eb8] text-lg font-bold text-white xl:h-11 xl:w-11 xl:text-xl">
                      {index + 1}
                    </span>
                    <span className="leading-snug pt-1">{item}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {tips && tips.length > 0 && !compact ? (
              <ul className="space-y-1.5">
                {tips.map((tip) => (
                  <li key={tip}>
                    <KioskImportant>{tip}</KioskImportant>
                  </li>
                ))}
              </ul>
            ) : null}
            {tips && tips.length > 0 && compact ? (
              <div className="shrink-0">
                {tips.map((tip) => (
                  <KioskImportant key={tip}>{tip}</KioskImportant>
                ))}
              </div>
            ) : null}
            {!showCapture && statusMessage && !showReading ? (
              <p className={`font-medium text-[#1d6eb8] ${kioskHelperClassName}`}>
                {statusMessage}
              </p>
            ) : null}
          </div>

          <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#f0f7ff] to-white ring-1 ring-slate-100 max-lg:min-h-[240px]">
            <div className="flex min-h-0 w-full flex-1 flex-col p-2 lg:min-h-0">
              <VitalIllustration type={illustration} />
            </div>
            {capturing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                <div className="mx-3 rounded-xl bg-white px-4 py-3 shadow-lg">
                  <p
                    className={`animate-pulse text-center font-medium text-[#1d6eb8] ${kioskHelperClassName}`}
                  >
                    {statusMessage || "Esperando lectura estable…"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 flex-row flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        {onBack && <KioskSecondaryButton onClick={onBack}>← Atrás</KioskSecondaryButton>}
        {onRetry && deviceStatus === "done" && (
          <KioskSecondaryButton onClick={onRetry}>Repetir medición</KioskSecondaryButton>
        )}
        <KioskPrimaryButton className="w-full flex-1" onClick={onContinue} disabled={continueBlocked}>
          Continuar
        </KioskPrimaryButton>
        <button
          type="button"
          onClick={onSimulate}
          className="text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          Simular lectura (modo demo)
        </button>
      </div>
    </KioskCard>
  );
}
