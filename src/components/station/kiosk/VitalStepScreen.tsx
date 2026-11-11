"use client";

import type { ReactNode } from "react";
import type { VitalBand, VitalReadingView } from "@/lib/kiosk/vital-ranges";
import { bandTone, VITAL_RANGE_COPY } from "@/lib/kiosk/vital-ranges";
import { VitalIllustration, type VitalIllustrationType } from "./KioskIllustrations";
import {
  KioskCard,
  KioskContinueRoundButton,
  KioskImportant,
  KioskSecondaryButton,
  KioskVitalsNavBar,
  StatusPill,
  kioskHelperClassName,
  kioskSubtitleClassName,
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
    <div className={`shrink-0 space-y-2 rounded-2xl border-2 px-4 py-3.5 xl:px-5 xl:py-5 ${tone.box}`}>
      <div className="grid grid-cols-2 gap-3 text-center xl:gap-4">
        {views.map((view) => {
          const t = bandTone(view.band);
          return (
            <div key={view.label} className={views.length === 1 ? "col-span-2" : undefined}>
              <p className="text-xl font-semibold uppercase tracking-wide text-slate-600 xl:text-2xl">
                {view.label}
              </p>
              <p className={`mt-1 text-6xl font-bold tabular-nums xl:text-7xl ${t.value}`}>
                {view.valueText}
              </p>
              <p className="mt-1.5 text-lg font-medium text-slate-600 xl:text-xl">
                Normal: {view.normalRange}
              </p>
              <span
                className={`mt-2 inline-block rounded-lg px-3 py-1.5 text-lg font-bold xl:text-xl ${t.badge}`}
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

  return (
    <KioskCard
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        compact ? "!p-4 sm:!p-5" : ""
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold uppercase tracking-wide text-[#1d6eb8] xl:text-2xl">
            Paso {stepNumber} de {totalSteps}
          </p>
          <h2 className="mt-1 text-5xl font-bold leading-tight tracking-tight text-slate-900 xl:text-6xl">
            {title}
          </h2>
        </div>
        <StatusPill status={capturing ? "reading" : deviceStatus} />
      </div>

      {instruction ? (
        <p className={`w-full shrink-0 ${kioskSubtitleClassName}`}>{instruction}</p>
      ) : null}

      {referenceRanges && referenceRanges.length > 0 && !showReading ? (
        <div className="mt-2 shrink-0 rounded-xl border-2 border-[#1d6eb8]/25 bg-[#f0f7ff] px-4 py-3.5 xl:px-5 xl:py-4">
          <p className="text-lg font-bold uppercase tracking-wide text-[#0b4f8a] xl:text-xl">
            Rango normal de referencia
          </p>
          <ul className="mt-2 space-y-1">
            {referenceRanges.map((line) => (
              <li key={line} className="text-xl font-semibold text-slate-800 xl:text-2xl">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative z-0 mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {showCapture ? (
          <div className="shrink-0 rounded-2xl border-2 border-teal-600 bg-teal-50 px-4 py-3.5 xl:px-6 xl:py-4">
            <p className="mb-2.5 text-center text-2xl font-bold text-teal-900 xl:text-3xl">
              Para iniciar, toque el botón verde
            </p>
            <button
              type="button"
              onClick={onCapture}
              disabled={capturing && !captureCanConfirm}
              className="flex w-full min-h-[88px] items-center justify-center rounded-2xl bg-teal-700 px-6 text-3xl font-bold text-white shadow-md transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60 xl:min-h-[100px] xl:text-4xl"
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
          <div className="shrink-0 grid grid-cols-2 gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3.5 text-center xl:gap-4 xl:py-5">
            <div>
              <p className="text-lg font-semibold uppercase tracking-wide text-emerald-800 xl:text-xl">
                {readingHighlight.primaryLabel}
              </p>
              <p className="mt-1 text-5xl font-bold tabular-nums text-emerald-950 xl:text-6xl">
                {readingHighlight.primary}
              </p>
            </div>
            {readingHighlight.secondary != null ? (
              <div>
                <p className="text-lg font-semibold uppercase tracking-wide text-emerald-800 xl:text-xl">
                  {readingHighlight.secondaryLabel ?? "Pulso"}
                </p>
                <p className="mt-1 text-5xl font-bold tabular-nums text-emerald-950 xl:text-6xl">
                  {readingHighlight.secondary}
                </p>
              </div>
            ) : null}
            <p className={`col-span-2 font-medium text-emerald-800 ${kioskHelperClassName}`}>
              {readingNote}
            </p>
          </div>
        ) : null}

        {/* Instrucciones | Continuar | Imagen — el botón ocupa el hueco central, sin tapar texto */}
        <div
          className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${
            compact
              ? "grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_auto_minmax(0,0.95fr)]"
              : "grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,0.85fr)]"
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
                    className={`flex min-h-0 items-center gap-3.5 rounded-2xl border-2 border-[#1d6eb8]/20 bg-[#f0f7ff] font-semibold text-slate-800 ${
                      compact
                        ? "px-3.5 py-3.5 text-xl leading-snug xl:px-4 xl:py-4 xl:text-2xl"
                        : "px-4 py-4 text-2xl leading-snug xl:px-5 xl:py-5 xl:text-3xl"
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-full bg-[#1d6eb8] font-bold text-white ${
                        compact
                          ? "h-11 w-11 text-xl xl:h-12 xl:w-12 xl:text-2xl"
                          : "h-12 w-12 text-2xl xl:h-14 xl:w-14 xl:text-3xl"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="leading-snug">{item}</span>
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

          <div className="flex items-end justify-center max-lg:order-last max-lg:py-1">
            <KioskContinueRoundButton
              onClick={onContinue}
              disabled={continueBlocked}
              pulse={deviceStatus === "done" && !continueBlocked}
            >
              Continuar
            </KioskContinueRoundButton>
          </div>

          <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#f0f7ff] to-white ring-1 ring-slate-100 max-lg:min-h-[220px]">
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

      <KioskVitalsNavBar
        left={
          <>
            {onBack ? (
              <KioskSecondaryButton
                className="!min-h-[52px] !px-3 !text-lg xl:!min-h-[56px] xl:!text-xl"
                onClick={onBack}
              >
                ← Atrás
              </KioskSecondaryButton>
            ) : null}
            {onRetry && deviceStatus === "done" ? (
              <KioskSecondaryButton
                className="!min-h-[52px] !px-3 !text-base xl:!min-h-[56px] xl:!text-lg"
                onClick={onRetry}
              >
                Repetir
              </KioskSecondaryButton>
            ) : null}
          </>
        }
        right={
          <button
            type="button"
            onClick={onSimulate}
            className="max-w-full text-right text-xs leading-snug text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline xl:text-sm"
          >
            Simular lectura
            <br />
            (modo demo)
          </button>
        }
      />
    </KioskCard>
  );
}
