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
} from "./KioskTheme";

/** Tipografía uniforme de signos vitales (misma en todos los pasos). */
const vitalStepLabel =
  "text-[clamp(1rem,1.8vh,1.25rem)] font-semibold uppercase tracking-wide text-[#1d6eb8]";
const vitalTitle =
  "text-[clamp(2rem,4.2vh,3.25rem)] font-bold leading-tight tracking-tight text-slate-900";
const vitalBody =
  "text-[clamp(0.88rem,1.65vh,1.25rem)] font-semibold leading-snug text-slate-800";
const vitalBadgeNum =
  "mt-0.5 flex aspect-square h-[clamp(1.75rem,3.2vh,2.4rem)] w-[clamp(1.75rem,3.2vh,2.4rem)] shrink-0 items-center justify-center rounded-full bg-[#1d6eb8] text-[clamp(0.85rem,1.7vh,1.1rem)] font-bold text-white";

function ReadingVerdict({ views }: { views: VitalReadingView[] }) {
  if (views.length === 0) return null;
  const worst: VitalBand = views.some((v) => v.band === "high" || v.band === "low")
    ? "high"
    : views.every((v) => v.band === "normal")
      ? "normal"
      : "info";
  const tone = bandTone(worst);
  const wideLast = views.length >= 3;

  return (
    <div className={`shrink-0 rounded-2xl border-2 px-3 py-2.5 xl:px-4 xl:py-3 ${tone.box}`}>
      <div
        className={`grid gap-2 text-center ${
          views.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {views.map((view, index) => {
          const t = bandTone(view.band);
          const spanFull = wideLast && index === views.length - 1;
          return (
            <div
              key={view.label}
              className={`min-w-0 rounded-xl bg-white/55 px-2.5 py-2 ${
                spanFull ? "col-span-2" : ""
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 xl:text-base">
                {view.label}
              </p>
              <p
                className={`mt-1 font-bold tabular-nums leading-none ${t.value} ${
                  spanFull
                    ? "text-4xl xl:text-5xl"
                    : "text-3xl xl:text-4xl"
                }`}
              >
                {view.valueText}
              </p>
              <p className="mt-1.5 text-xs font-medium leading-snug text-slate-600 xl:text-sm">
                Normal: {view.normalRange}
              </p>
              <span
                className={`mt-1.5 inline-block max-w-full truncate rounded-lg px-2.5 py-1 text-xs font-bold xl:text-sm ${t.badge}`}
              >
                {view.verdict}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs font-medium leading-snug text-slate-600 xl:text-sm">
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
  readingHighlight,
  readingViews,
  referenceRanges,
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
        compact ? "!p-3 sm:!p-4" : ""
      }`}
    >
      {/* Cabecera: título + parámetros a la derecha (chip pastel) + estado */}
      <div className="flex shrink-0 items-start gap-3">
        <div className="min-w-0 flex-[1.1]">
          <p className={vitalStepLabel}>
            Paso {stepNumber} de {totalSteps}
          </p>
          <h2 className={`mt-0.5 ${vitalTitle}`}>{title}</h2>
          {instruction ? (
            <p className="mt-1 text-[clamp(1rem,2vh,1.35rem)] leading-snug text-slate-600">
              {instruction}
            </p>
          ) : null}
        </div>

        {referenceRanges && referenceRanges.length > 0 && !showReading ? (
          <div className="min-w-0 flex-[0.9] rounded-2xl border-2 border-[#7eb8a0]/50 bg-[#e8f6ef] px-3 py-2.5 shadow-sm xl:px-4 xl:py-3">
            <p className="text-[clamp(0.85rem,1.5vh,1.05rem)] font-bold uppercase tracking-wide text-[#1f6b4a]">
              Rango normal
            </p>
            <ul className="mt-1 space-y-0.5">
              {referenceRanges.map((line) => (
                <li
                  key={line}
                  className="text-[clamp(1rem,2.1vh,1.45rem)] font-semibold leading-snug text-[#14533a]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <StatusPill status={capturing ? "reading" : deviceStatus} />
      </div>

      {/* Cuerpo: izquierda acciones+pasos | derecha imagen grande + Continuar */}
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* Columna izquierda: scroll si el veredicto + pasos no caben */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto overscroll-contain">
          {showCapture ? (
            <div className="shrink-0 rounded-2xl border-2 border-teal-600/80 bg-teal-50 px-3 py-2">
              <p className="mb-1.5 text-center text-[clamp(1rem,2vh,1.35rem)] font-bold text-teal-900">
                Para iniciar, toque el botón verde
              </p>
              <button
                type="button"
                onClick={onCapture}
                disabled={capturing && !captureCanConfirm}
                className="mx-auto flex w-full max-w-xl min-h-[clamp(3.4rem,7vh,4.6rem)] items-center justify-center rounded-2xl bg-teal-700 px-5 text-[clamp(1.25rem,2.8vh,1.85rem)] font-bold text-white shadow-md transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60"
              >
                {capturing ? capturingLabel : captureLabel}
              </button>
              {statusMessage && !showReading ? (
                <p className="mt-1.5 text-center text-[clamp(0.95rem,1.7vh,1.2rem)] font-medium text-teal-800">
                  {statusMessage}
                </p>
              ) : null}
              {captureHelp && !compact ? (
                <p className="mt-1 text-center text-[clamp(0.85rem,1.5vh,1.05rem)] text-teal-800/80">
                  {captureHelp}
                </p>
              ) : null}
            </div>
          ) : null}

          {extra}

          {showReading && readingViews && readingViews.length > 0 ? (
            <ReadingVerdict views={readingViews} />
          ) : null}

          {showReading && (!readingViews || readingViews.length === 0) && readingHighlight ? (
            <div className="shrink-0 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 text-center xl:px-4 xl:py-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl bg-white/55 px-2.5 py-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800 xl:text-base">
                    {readingHighlight.primaryLabel}
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums leading-none text-emerald-950 xl:text-4xl">
                    {readingHighlight.primary}
                  </p>
                </div>
                {readingHighlight.secondary != null ? (
                  <div className="min-w-0 rounded-xl bg-white/55 px-2.5 py-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800 xl:text-base">
                      {readingHighlight.secondaryLabel ?? "Pulso"}
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums leading-none text-emerald-950 xl:text-4xl">
                      {readingHighlight.secondary}
                    </p>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-medium text-emerald-800 xl:text-sm">{readingNote}</p>
            </div>
          ) : null}

          {steps && steps.length > 0 ? (
            <ol
              className={`grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-y-auto overscroll-contain ${
                compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {steps.map((item, index) => (
                <li
                  key={item}
                  className="flex h-auto items-start gap-2.5 overflow-visible rounded-2xl border-2 border-[#1d6eb8]/25 bg-[#f0f7ff] px-3 py-2.5"
                >
                  <span className={vitalBadgeNum}>{index + 1}</span>
                  <span className={`min-w-0 flex-1 break-words ${vitalBody}`}>{item}</span>
                </li>
              ))}
            </ol>
          ) : null}

        </div>

        {/* Columna derecha: ilustración + avisos amarillos al lado de Continuar */}
        <div className="relative flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#f0f7ff] to-white ring-1 ring-slate-100">
            <div className="flex min-h-0 w-full flex-1 flex-col p-2">
              <VitalIllustration type={illustration} />
            </div>
            {capturing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                <div className="mx-3 rounded-xl bg-white px-4 py-3 shadow-lg">
                  <p className="animate-pulse text-center text-[clamp(1rem,2vh,1.35rem)] font-medium text-[#1d6eb8]">
                    {statusMessage || "Esperando lectura estable…"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-end gap-2 lg:pr-1">
            {tips && tips.length > 0 ? (
              <div className="min-w-0 flex-1 space-y-1.5">
                {tips.map((tip) => (
                  <KioskImportant
                    key={tip}
                    className="!px-3 !py-2 !text-[clamp(0.9rem,1.7vh,1.2rem)] !leading-snug"
                  >
                    {tip}
                  </KioskImportant>
                ))}
              </div>
            ) : (
              <div className="min-w-0 flex-1" aria-hidden />
            )}
            <KioskContinueRoundButton
              className="!h-[clamp(8.5rem,18vh,12.5rem)] !w-[clamp(8.5rem,18vh,12.5rem)] !text-[clamp(1.35rem,2.8vh,2rem)]"
              onClick={onContinue}
              disabled={continueBlocked}
              pulse={deviceStatus === "done" && !continueBlocked}
            >
              Continuar
            </KioskContinueRoundButton>
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
