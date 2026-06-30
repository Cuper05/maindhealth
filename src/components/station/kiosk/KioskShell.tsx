"use client";

import type { KioskStep } from "@/lib/db/schema/station-kiosk";
import { KIOSK_STEP_ORDER, KIOSK_STEP_SHORT, StatusPill } from "./KioskTheme";
import { VitalsPanel } from "./VitalsPanel";
import type { VitalsDraft } from "./kiosk-api";

export function KioskShell({
  step,
  patientName,
  deviceStatus,
  vitalsDraft,
  showVitalsPanel,
  children,
}: {
  step: KioskStep;
  patientName?: string;
  deviceStatus: string;
  vitalsDraft: VitalsDraft;
  showVitalsPanel: boolean;
  children: React.ReactNode;
}) {
  const stepIndex = KIOSK_STEP_ORDER.indexOf(step);
  const status = (["idle", "waiting", "reading", "done", "retry"].includes(deviceStatus)
    ? deviceStatus
    : "idle") as "idle" | "waiting" | "reading" | "done" | "retry";

  return (
    <div className="flex min-h-screen flex-col bg-[#eef3f9]">
      <header className="bg-gradient-to-r from-[#143d66] via-[#1a4d7c] to-[#1d6eb8] text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-bold backdrop-blur">
                MH
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-blue-200">
                  MaindHealth · Estación
                </p>
                <h1 className="text-lg font-semibold md:text-xl">
                  {patientName ? patientName : "Telemedicina"}
                </h1>
              </div>
            </div>
            <p className="text-sm text-blue-100">{KIOSK_STEP_SHORT[step]}</p>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <ol className="flex min-w-max items-center gap-0">
              {KIOSK_STEP_ORDER.map((s, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <li key={s} className="flex items-center">
                    <div className="flex flex-col items-center px-1">
                      <span
                        className={`flex h-3 w-3 rounded-full transition ${
                          active
                            ? "scale-125 bg-white ring-4 ring-white/30"
                            : done
                              ? "bg-emerald-400"
                              : "bg-white/30"
                        }`}
                      />
                      <span
                        className={`mt-1.5 hidden text-[10px] font-medium sm:block ${
                          active ? "text-white" : done ? "text-emerald-200" : "text-blue-300/80"
                        }`}
                      >
                        {KIOSK_STEP_SHORT[s]}
                      </span>
                    </div>
                    {i < KIOSK_STEP_ORDER.length - 1 && (
                      <div
                        className={`mx-0.5 h-0.5 w-4 sm:w-6 ${done ? "bg-emerald-400/80" : "bg-white/20"}`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
        <main className="min-w-0 flex-1">{children}</main>
        {showVitalsPanel && (
          <div className="w-full shrink-0 md:w-80 lg:w-72">
            <div className="md:sticky md:top-6">
              <VitalsPanel draft={vitalsDraft} />
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <StatusPill status={status} />
          <p className="text-xs text-slate-400">
            Sigue las instrucciones en pantalla · Personal disponible si necesitas ayuda
          </p>
        </div>
      </footer>
    </div>
  );
}
