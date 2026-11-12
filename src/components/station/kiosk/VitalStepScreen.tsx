"use client";

import type { ReactNode } from "react";
import type { VitalBand, VitalReadingView } from "@/lib/kiosk/vital-ranges";
import { bandTone, VITAL_RANGE_COPY } from "@/lib/kiosk/vital-ranges";
import { VitalIllustration, type VitalIllustrationType } from "./KioskIllustrations";
import {
  KioskCard,
  KioskImportant,
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
  captureCanConfirm = false,
  /**
   * Layout de una sola pantalla: instrucciones en 2 columnas + botones grandes
   * aprovechando todo el alto disponible (sin achicar el tacto).
   */
   compact = false,
  extra,
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
  /** Permite un segundo toque mientras espera (p. ej. «Ya vi el resultado»). */
  captureCanConfirm?: boolean;
  compact?: boolean;
  extra?: ReactNode;
}) {
  const showCapture = Boolean(onCapture) && deviceStatus !== "done";
  const continueBlocked =
    capturing || (Boolean(onCapture) && !captureOptional && deviceStatus !== "done");
  const showReading =
    deviceStatus === "done" &&
    !capturing &&
    (Boolean(readingViews?.length) || Boolean(readingHighlight));
  /** Tras lectura real o «Simular lectura»: Continuar centrado y visible. */
  const showCenterContinue = deviceStatus === "done" && !capturing && !continueBlocked;

  return (
    <KioskCard
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${
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
        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border-2 border-[#1d6eb8]/25 bg-[#f0f7ff] px-4 py-2.5">
          <p className="shrink-0 text-sm font-bold uppercase tracking-wide text-[#0b4f8a] xl:text-base">
            Rango normal de referencia
          </p>
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1">
            {referenceRanges.map((line) => (
              <li
                key={line}
                className={`text-lg font-bold xl:text-xl ${
                  /IMC/i.test(line) ? "text-orange-700" : "text-slate-900"
                }`}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {showCapture ? (
          <div className="shrink-0 rounded-2xl border-2 border-teal-600 bg-teal-50 px-3 py-2.5 xl:px-4 xl:py-3">
            <p className="mb-1.5 text-center text-xl font-bold text-teal-900 xl:text-2xl">
              Para iniciar, toque el botón verde
            </p>
            <button
              type="button"
              onClick={onCapture}
              disabled={capturing && !captureCanConfirm}
              className="flex w-full min-h-[72px] items-center justify-center rounded-2xl bg-teal-700 px-6 text-3xl font-black leading-tight text-white shadow-md transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60 xl:min-h-[84px] xl:text-4xl"
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

        {extra}

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
          className={`grid min-h-0 flex-1 gap-2 overflow-hidden ${
            compact && illustration === "weight_height"
              ? "grid-cols-1 lg:grid-cols-[0.65fr_1.35fr]"
              : compact
                ? "grid-cols-1 lg:grid-cols-[1fr_1fr]"
                : "grid-cols-1 lg:grid-cols-[1fr_1fr]"
          }`}
        >
          <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
            {steps && steps.length > 0 ? (
              <ol
                className={`grid min-h-0 flex-1 gap-2 overflow-hidden ${
                  compact
                    ? "grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 auto-rows-fr"
                    : "grid-cols-1"
                }`}
              >
                {steps.map((item, index) => (
                  <li
                    key={item}
                    className="flex min-h-0 items-center gap-3 overflow-hidden rounded-2xl border-2 border-[#1d6eb8]/20 bg-[#f0f7ff] px-3 py-2.5 text-[clamp(1.05rem,2.3vh,1.7rem)] font-semibold leading-tight text-slate-900 xl:gap-4 xl:px-4 xl:py-3 xl:text-[clamp(1.2rem,2.6vh,1.95rem)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1d6eb8] text-lg font-bold text-white xl:h-12 xl:w-12 xl:text-2xl">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{item}</span>
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

          <div
            className={`relative flex min-h-0 flex-col ${
              illustration === "weight_height"
                ? "overflow-visible"
                : "overflow-hidden"
            }`}
          >
            <VitalIllustration type={illustration} />
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

      <div
        className={`mt-3 flex shrink-0 flex-row flex-wrap items-center gap-3 border-t border-slate-100 pt-3 ${
          showCenterContinue ? "relative z-40" : ""
        }`}
      >
        {onBack ? (
          <KioskSecondaryButton
            onClick={onBack}
            className={
              showCenterContinue
                ? "!min-h-[88px] !border-[3px] !border-slate-700 !bg-white !px-8 !text-3xl !font-black !text-slate-900 shadow-lg xl:!min-h-[104px] xl:!px-10 xl:!text-4xl"
                : undefined
            }
          >
            ← Atrás
          </KioskSecondaryButton>
        ) : null}
        {!showCenterContinue && onRetry && deviceStatus === "done" && (
          <KioskSecondaryButton onClick={onRetry}>Repetir medición</KioskSecondaryButton>
        )}
        <div className="min-h-[72px] flex-1 xl:min-h-[80px]" aria-hidden />
        {!showCenterContinue ? (
          <button
            type="button"
            onClick={onSimulate}
            className="text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            Simular lectura (modo demo)
          </button>
        ) : null}
      </div>

      {showCenterContinue ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center kiosk-continue-enter"
          role="dialog"
          aria-modal="true"
          aria-label="Continuar al siguiente paso"
        >
          {/* Bloquea el resto de la pantalla: toques fuera no hacen nada */}
          <div
            className="absolute inset-0 bg-[#0b2340]/35 backdrop-blur-[1.5px]"
            aria-hidden
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-4 px-4 pointer-events-auto">
            <p className="rounded-full border border-white/70 bg-white/95 px-6 py-2.5 text-2xl font-bold text-orange-900 shadow-md xl:text-3xl">
              Lectura lista — toque Continuar
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="kiosk-continue-pulse flex h-[18rem] w-[18rem] flex-col items-center justify-center gap-2 rounded-full bg-[#ea580c] px-6 text-center text-3xl font-black leading-none text-white ring-8 ring-white/95 shadow-2xl xl:h-[20rem] xl:w-[20rem] xl:text-4xl"
            >
              <span className="max-w-[90%] break-words">Continuar</span>
              <span aria-hidden className="text-4xl leading-none xl:text-5xl">
                →
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </KioskCard>
  );
}
