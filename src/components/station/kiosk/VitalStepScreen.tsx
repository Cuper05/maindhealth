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
  deviceStatus,
  onContinue,
  onSimulate,
  onBack,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  instruction: string;
  illustration: VitalIllustrationType;
  deviceStatus: "idle" | "waiting" | "reading" | "done" | "retry";
  onContinue: () => void;
  onSimulate: () => void;
  onBack?: () => void;
}) {
  const illustType =
    stepNumber === 1
      ? "blood_pressure"
      : stepNumber === 2
        ? "oxygen"
        : stepNumber === 3
          ? "weight_height"
          : "temperature";

  return (
    <KioskCard className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6eb8]">
            Paso {stepNumber} de {totalSteps}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
        </div>
        <StatusPill status={deviceStatus} />
      </div>

      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">{instruction}</p>

      <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-b from-[#f0f7ff] to-white py-6 ring-1 ring-slate-100">
        <VitalIllustration type={illustType} />
        {deviceStatus === "reading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="rounded-2xl bg-white px-6 py-4 shadow-lg">
              <p className="animate-pulse text-center font-medium text-[#1d6eb8]">
                Lectura en proceso…
              </p>
            </div>
          </div>
        )}
        {deviceStatus === "done" && (
          <div className="mt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600">
                ✓
              </span>
              Lectura recibida
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        {onBack && <KioskSecondaryButton onClick={onBack}>← Atrás</KioskSecondaryButton>}
        <KioskPrimaryButton onClick={onContinue}>Continuar</KioskPrimaryButton>
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
