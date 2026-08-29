"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { stopKioskVoice } from "@/lib/kiosk/voice-guide";

type WaitingItem = {
  sessionId: number;
  appointmentId: number;
  patientName: string;
  chartNumber: string;
  meetingUrl: string | null;
  redFlags: string[];
  summary: string | null;
  updatedAt: string | Date;
};

const STATION_MODE_KEY = "maindhealth:station-pc";
const OPENED_KEY = "maindhealth:station-auto-opened";
const COUNTDOWN_SEC = 6;
const POLL_MS = 2000;
const NAV_FAIL_MS = COUNTDOWN_SEC * 1000 + 4000;

function readStationMode(): boolean {
  try {
    return localStorage.getItem(STATION_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function enableStationMode() {
  try {
    localStorage.setItem(STATION_MODE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function disableStationMode() {
  try {
    localStorage.removeItem(STATION_MODE_KEY);
  } catch {
    /* ignore */
  }
}

function readOpened(): number[] {
  try {
    const raw = sessionStorage.getItem(OPENED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function markOpened(appointmentId: number) {
  try {
    const next = Array.from(new Set([...readOpened(), appointmentId]));
    sessionStorage.setItem(OPENED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function unmarkOpened(appointmentId: number) {
  try {
    sessionStorage.setItem(
      OPENED_KEY,
      JSON.stringify(readOpened().filter((id) => id !== appointmentId)),
    );
  } catch {
    /* ignore */
  }
}

function salaPath(appointmentId: number) {
  return `/estacion/sala/${appointmentId}`;
}

function goToSala(appointmentId: number) {
  console.info("[station-autopilot] navigating to", salaPath(appointmentId));
  markOpened(appointmentId);
  window.location.assign(salaPath(appointmentId));
}

async function dismissWaiting(appointmentId: number) {
  await fetch("/api/station/waiting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "dismiss", appointmentId }),
  });
}

/**
 * Dell: abre /estacion/sala cuando hay paciente NUEVO en waiting_doctor.
 * No reabre citas ya intentadas. En /sala no hace nada (evita parpadeo).
 */
export function StationTeleconsultaAutoPilot({
  initialWaiting = [],
  forceEnabled = false,
  /** PC Dell dedicada: sin letrero de activar/desactivar (siempre ON). */
  dedicatedUi = false,
}: {
  initialWaiting?: WaitingItem[];
  forceEnabled?: boolean;
  dedicatedUi?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [stationMode, setStationMode] = useState(false);
  const [pending, setPending] = useState<WaitingItem | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);
  const [authLost, setAuthLost] = useState(false);
  const [navFailed, setNavFailed] = useState<WaitingItem | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const navigatingRef = useRef(false);
  const pendingIdRef = useRef<number | null>(null);

  const onEstacionSection = pathname === "/estacion" || pathname.startsWith("/estacion/");
  const onSala = pathname.startsWith("/estacion/sala/");
  const active = forceEnabled || stationMode;

  useEffect(() => {
    if (forceEnabled || onEstacionSection) {
      enableStationMode();
      setStationMode(true);
    } else {
      setStationMode(readStationMode());
    }
  }, [forceEnabled, onEstacionSection]);

  useEffect(() => {
    if (!active || onSala || navigatingRef.current) return;
    const opened = new Set(readOpened());
    const first = initialWaiting.find((item) => !opened.has(item.appointmentId));
    if (first) setPending((prev) => prev ?? first);
  }, [active, initialWaiting, onSala]);

  useEffect(() => {
    if (!active || onSala) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/station/waiting", { cache: "no-store" });
        if (cancelled) return;

        if (res.status === 401) {
          setAuthLost(true);
          setPollError("Sesión expirada");
          return;
        }
        if (!res.ok) {
          setPollError(`Error cola (${res.status})`);
          return;
        }

        setAuthLost(false);
        setPollError(null);
        const data = (await res.json()) as { waiting?: WaitingItem[] };
        const waiting = data.waiting ?? [];
        const opened = new Set(readOpened());

        const candidate =
          waiting.find((item) => !opened.has(item.appointmentId)) ?? null;

        if (candidate && !navigatingRef.current) {
          setPending((prev) =>
            prev?.appointmentId === candidate.appointmentId ? prev : candidate,
          );
        } else if (!candidate) {
          setPending(null);
        }
      } catch (err) {
        console.warn("[station-autopilot] poll failed", err);
        if (!cancelled) setPollError("Sin conexión a la cola");
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, onSala]);

  useEffect(() => {
    if (!pending || onSala || navigatingRef.current || !active) return;

    pendingIdRef.current = pending.appointmentId;
    setSecondsLeft(COUNTDOWN_SEC);
    setNavFailed(null);
    stopKioskVoice();

    const tick = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          if (!navigatingRef.current && pendingIdRef.current === pending.appointmentId) {
            navigatingRef.current = true;
            stopKioskVoice();
            goToSala(pending.appointmentId);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const failTimer = window.setTimeout(() => {
      if (navigatingRef.current && pendingIdRef.current === pending.appointmentId) {
        const stillHere = window.location.pathname !== salaPath(pending.appointmentId);
        if (stillHere) {
          navigatingRef.current = false;
          unmarkOpened(pending.appointmentId);
          setNavFailed(pending);
        }
      }
    }, NAV_FAIL_MS);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(failTimer);
      stopKioskVoice();
    };
  }, [pending, onSala, active]);

  // En sala no mostrar controles flotantes (la videollamada es prioridad).
  if (onSala) return null;

  const showOverlay = Boolean(pending && active);
  const modeOn = active;

  return (
    <>
      {!dedicatedUi ? (
        <div
          className={`fixed bottom-3 left-3 z-[70] max-w-[16rem] rounded-lg border px-3 py-2 text-left shadow-lg ${
            modeOn
              ? "border-emerald-400/40 bg-[#0f3d66]/95 text-white"
              : "border-amber-400/50 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="text-xs font-semibold">
            {modeOn ? "Teleconsulta automática: ON" : "Teleconsulta automática: OFF"}
          </p>
          <p className="mt-0.5 text-[10px] opacity-80">
            {modeOn
              ? "La Dell abrirá la sala cuando haya paciente en espera."
              : "La estación no abrirá teleconsultas sola."}
          </p>
          {modeOn ? (
            <button
              type="button"
              className="mt-1.5 text-[11px] font-medium underline opacity-80 hover:opacity-100"
              onClick={() => {
                disableStationMode();
                setStationMode(false);
              }}
            >
              Desactivar
            </button>
          ) : (
            <button
              type="button"
              className="mt-1.5 rounded-md bg-[#1d6eb8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#185a96]"
              onClick={() => {
                enableStationMode();
                setStationMode(true);
              }}
            >
              Activar ahora
            </button>
          )}
        </div>
      ) : null}

      {pollError && !authLost && modeOn && !dedicatedUi ? (
        <div className="fixed top-3 left-1/2 z-[75] w-[min(96vw,28rem)] -translate-x-1/2 rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-xl">
          <p className="font-semibold">Vigilancia de estación: {pollError}</p>
        </div>
      ) : null}

      {authLost ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0c2a47]/95 p-6">
          <div className="max-w-md rounded-2xl bg-white p-6 text-center text-slate-900">
            <p className="text-lg font-bold">Sesión de estación expirada</p>
            <a href="/login" className="mt-4 inline-block rounded-xl bg-[#1d6eb8] px-5 py-3 font-semibold text-white">
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : null}

      {navFailed ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-md rounded-2xl bg-white p-6 text-center">
            <p className="text-lg font-bold text-slate-900">No se pudo abrir la sala</p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-[#1d6eb8] px-5 py-3 font-semibold text-white"
              onClick={() => {
                navigatingRef.current = true;
                goToSala(navFailed.appointmentId);
              }}
            >
              Abrir sala ahora
            </button>
            <button
              type="button"
              className="mt-3 block w-full text-sm text-slate-600 underline"
              disabled={dismissing}
              onClick={() => {
                void (async () => {
                  setDismissing(true);
                  try {
                    await dismissWaiting(navFailed.appointmentId);
                    markOpened(navFailed.appointmentId);
                    setNavFailed(null);
                    setPending(null);
                  } finally {
                    setDismissing(false);
                  }
                })();
              }}
            >
              Descartar esta espera
            </button>
          </div>
        </div>
      ) : null}

      {showOverlay ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0c2a47]/92 p-6"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-[#0f3d66] px-8 py-10 text-center text-white shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
              Teleconsulta entrante
            </p>
            <p className="mt-3 text-2xl font-bold">{pending?.patientName}</p>
            <p className="mt-2 text-lg text-blue-100">Abriendo sala en {secondsLeft}s…</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="rounded-xl bg-white px-6 py-3 text-base font-bold text-[#0f3d66]"
                onClick={() => {
                  if (!pending || navigatingRef.current) return;
                  navigatingRef.current = true;
                  goToSala(pending.appointmentId);
                }}
              >
                Abrir ahora
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/40 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                disabled={dismissing || !pending}
                onClick={() => {
                  if (!pending) return;
                  void (async () => {
                    setDismissing(true);
                    const id = pending.appointmentId;
                    try {
                      await dismissWaiting(id);
                      markOpened(id);
                      pendingIdRef.current = null;
                      setPending(null);
                      navigatingRef.current = false;
                    } finally {
                      setDismissing(false);
                    }
                  })();
                }}
              >
                {dismissing ? "Descartando…" : "No abrir / descartar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
