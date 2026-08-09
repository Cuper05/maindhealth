"use client";

import { VitalIllustration, type VitalIllustrationType } from "./KioskIllustrations";
import {
  KioskCard,
  KioskPrimaryButton,
  KioskSecondaryButton,
  StatusPill,
} from "./KioskTheme";

export function VitalStepScreen({
  stepNumber,
  totalSteps,
  title,
  instruction,
  illustration,
  deviceStatus,
  statusMessage,
  onContinue,
  onSimulate,
  onBack,
  onRetry,
  onCapture,
  captureLabel = "Leer dispositivo",
  capturing = false,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  instruction: string;
  illustration: VitalIllustrationType;
  deviceStatus: "idle" | "waiting" | "reading" | "done" | "retry";
  statusMessage?: string;
  onContinue: () => void;
  onSimulate: () => void;
  onBack?: () => void;
  onRetry?: () => void;
  onCapture?: () => void;
  captureLabel?: string;
  /** Solo true mientras esta captura está en curso (no el poll/sesión vieja). */
  capturing?: boolean;
}) {
  const showCapture = Boolean(onCapture) && deviceStatus !== "done";

  return (
    <KioskCard className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6eb8]">
            Paso {stepNumber} de {totalSteps}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
        </div>
        <StatusPill status={capturing ? "reading" : deviceStatus} />
      </div>

      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">{instruction}</p>
      {statusMessage ? (
        <p className="mt-2 text-base font-medium text-[#1d6eb8]">{statusMessage}</p>
      ) : null}

      {showCapture ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={onCapture}
            disabled={capturing}
            className="flex w-full min-h-[72px] items-center justify-center rounded-2xl bg-teal-700 px-6 text-xl font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60"
          >
            {capturing ? "Leyendo oxímetro…" : captureLabel}
          </button>
          <p className="mt-2 text-center text-sm text-slate-500">
            Necesitas el servicio local abierto (iniciar-servicio-oximetro.bat). Si Chrome pide red
            local, elige Permitir.
          </p>
        </div>
      ) : null}

      <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-b from-[#f0f7ff] to-white py-6 ring-1 ring-slate-100">
        <VitalIllustration type={illustration} />
        {capturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="rounded-2xl bg-white px-6 py-4 shadow-lg">
              <p className="animate-pulse text-center font-medium text-[#1d6eb8]">
                {statusMessage || "Lectura en proceso…"}
              </p>
            </div>
          </div>
        )}
        {deviceStatus === "done" && !capturing && (
          <div className="mt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600">
                ✓
              </span>
              {statusMessage || "Lectura recibida"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        {onBack && (
          <KioskSecondaryButton onClick={onBack}>← Atrás</KioskSecondaryButton>
        )}
        {onRetry && deviceStatus === "done" && (
          <KioskSecondaryButton onClick={onRetry}>Repetir medición</KioskSecondaryButton>
        )}
        <KioskPrimaryButton
          onClick={onContinue}
          disabled={capturing || (Boolean(onCapture) && deviceStatus !== "done")}
        >
          Continuar
        </KioskPrimaryButton>
        <button
          type="button"
          onClick={onSimulate}
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          Simular lectura (modo demo)
        </button>
      </div>
    </KioskCard>
  );
}
