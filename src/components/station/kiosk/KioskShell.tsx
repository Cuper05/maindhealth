"use client";

import { useRef } from "react";
import type { KioskStep } from "@/lib/db/schema/station-kiosk";
import { BrandLogo } from "@/components/BrandLogo";
import { MaindOsLogo } from "@/components/MaindOsLogo";
import { KIOSK_STEP_ORDER, KIOSK_STEP_SHORT, StatusPill } from "./KioskTheme";
import { VitalsPanel } from "./VitalsPanel";
import type { VitalsDraft } from "./kiosk-api";
import { KioskOnScreenKeyboard, useKioskVirtualKeyboard } from "./KioskOnScreenKeyboard";

const KEYBOARD_STEPS: KioskStep[] = [
  "registration",
  "symptoms",
  "antecedents",
  "consent",
  "clinical",
  "identification",
  "payment",
  "service",
];

const LOGO_LONG_PRESS_MS = 1800;

/** Force a fresh document load (useful after deploy; Edge kiosk has no Ctrl+F5). */
function reloadKioskApp() {
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}

export function KioskShell({
  step,
  patientName,
  deviceStatus,
  vitalsDraft,
  showVitalsPanel,
  onNewSession,
  voiceMuted,
  onToggleVoice,
  children,
}: {
  step: KioskStep;
  patientName?: string;
  deviceStatus: string;
  vitalsDraft: VitalsDraft;
  showVitalsPanel: boolean;
  onNewSession?: () => void;
  voiceMuted?: boolean;
  onToggleVoice?: () => void;
  children: React.ReactNode;
}) {
  const stepIndex = KIOSK_STEP_ORDER.indexOf(step);
  const status = (["idle", "waiting", "reading", "done", "retry"].includes(deviceStatus)
    ? deviceStatus
    : "idle") as "idle" | "waiting" | "reading" | "done" | "retry";

  const keyboardEnabled = KEYBOARD_STEPS.includes(step);
  const { open: keyboardOpen, target, close } = useKioskVirtualKeyboard(keyboardEnabled);
  const logoPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWelcome = step === "welcome";
  // Scroll global con teclado; en cada paso el contenido usa KioskScrollArea si no cabe.
  const allowScroll = keyboardOpen || step !== "welcome";

  function clearLogoPress() {
    if (logoPressTimer.current) {
      clearTimeout(logoPressTimer.current);
      logoPressTimer.current = null;
    }
  }

  function startLogoPress() {
    clearLogoPress();
    logoPressTimer.current = setTimeout(() => {
      logoPressTimer.current = null;
      reloadKioskApp();
    }, LOGO_LONG_PRESS_MS);
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#eef3f9]">
      <header className="relative shrink-0 bg-gradient-to-r from-[#143d66] via-[#1a4d7c] to-[#1d6eb8] text-white shadow-md">
        <div className="w-full px-4 py-3 sm:px-6 xl:px-10">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                aria-label="Mantén pulsado el logo para recargar la app"
                title="Personal: mantén pulsado ~2 s para recargar"
                onPointerDown={startLogoPress}
                onPointerUp={clearLogoPress}
                onPointerLeave={clearLogoPress}
                onPointerCancel={clearLogoPress}
                className="rounded-xl bg-white px-2.5 py-1.5 select-none touch-manipulation shadow-sm"
              >
                <BrandLogo width={120} priority />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-200 xl:text-base">
                  Estación
                </p>
                <h1 className="truncate text-2xl font-semibold xl:text-3xl">
                  {patientName ? patientName : "Telemedicina"}
                </h1>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
              <MaindOsLogo width={260} priority className="max-w-[42vw]" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 md:min-w-[260px]">
              {onToggleVoice ? (
                <button
                  type="button"
                  onClick={onToggleVoice}
                  className="min-h-[48px] rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-lg font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  aria-pressed={voiceMuted === true}
                >
                  {voiceMuted ? "Activar voz" : "Silenciar voz"}
                </button>
              ) : null}
              <p className="rounded-lg bg-white/10 px-4 py-2 text-lg font-medium text-blue-50">
                {KIOSK_STEP_SHORT[step]}
              </p>
              {onNewSession && step !== "welcome" ? (
                <button
                  type="button"
                  onClick={onNewSession}
                  className="min-h-[48px] rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-lg font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Nueva atención
                </button>
              ) : null}
              <button
                type="button"
                onClick={reloadKioskApp}
                className="min-h-[48px] rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-lg font-semibold text-white backdrop-blur transition hover:bg-white/20"
                title="Personal: recarga tras deploy"
              >
                Recargar
              </button>
            </div>
          </div>

          {!isWelcome ? (
            <div className="mt-3 overflow-x-auto pb-0.5">
              <ol className="flex min-w-max items-center gap-0">
                {KIOSK_STEP_ORDER.map((s, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <li key={s} className="flex items-center">
                      <div className="flex flex-col items-center px-0.5">
                        <span
                          className={`flex h-3 w-3 rounded-full transition ${
                            active
                              ? "scale-125 bg-white ring-2 ring-white/30"
                              : done
                                ? "bg-emerald-400"
                                : "bg-white/30"
                          }`}
                        />
                      </div>
                      {i < KIOSK_STEP_ORDER.length - 1 && (
                        <div
                          className={`mx-0.5 h-0.5 w-4 sm:w-5 ${done ? "bg-emerald-400/80" : "bg-white/20"}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>
      </header>

      <div
        className={`flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden p-3 sm:p-5 xl:p-6 ${
          showVitalsPanel ? "md:flex-row" : ""
        } ${keyboardOpen ? "pb-[320px]" : ""}`}
      >
        <main
          className={`h-full min-h-0 min-w-0 flex-1 ${
            allowScroll ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
          }`}
        >
          {children}
        </main>
        {showVitalsPanel && (
          <div className="hidden h-full min-h-0 w-64 shrink-0 lg:block xl:w-72">
            <VitalsPanel draft={vitalsDraft} />
          </div>
        )}
      </div>

      <footer
        className="shrink-0 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-6"
        style={{ marginBottom: keyboardOpen ? "var(--kiosk-keyboard-height, 300px)" : undefined }}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <StatusPill status={status} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reloadKioskApp}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 px-5 py-2.5 text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-[0.98]"
              title="Personal: recarga la app tras un deploy (también: mantener pulsado el logo ~2 s)"
            >
              Recargar app
            </button>
            {onNewSession ? (
              <button
                type="button"
                onClick={onNewSession}
                className="min-h-[48px] rounded-xl border border-[#1d6eb8]/30 bg-[#f0f7ff] px-5 py-2.5 text-lg font-semibold text-[#1d6eb8] shadow-sm transition hover:bg-[#e0effc] active:scale-[0.98]"
                title="Personal: reinicia la atención actual"
              >
                Nueva atención
              </button>
            ) : null}
            <p className="text-lg text-slate-500">Guía por voz · Personal disponible</p>
          </div>
        </div>
      </footer>

      <KioskOnScreenKeyboard open={keyboardOpen} target={target} onClose={close} />
    </div>
  );
}
