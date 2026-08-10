"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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
const COUNTDOWN_SEC = 1;
const POLL_MS = 1500;
const NAV_FAIL_MS = 2500;

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
  const next = [...new Set([...readOpened(), appointmentId])];
  try {
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
  const path = salaPath(appointmentId);
  console.info("[station-autopilot] navigating to", path);
  markOpened(appointmentId);
  // Hard navigation: router.push can stall under load; critically ill patients cannot wait.
  window.location.assign(path);
}

/**
 * PC Dell de estación: sondea cola waiting_doctor y abre /estacion/sala/[id] sola.
 *
 * Activa "modo estación" al visitar /estacion* y permanece activo en localStorage
 * aunque el staff navegue a Agenda u otras rutas — sin eso el auto-join nunca corría.
 * No se activa en laptops de médicos remotos (nunca abren /estacion).
 */
export function StationTeleconsultaAutoPilot({
  initialWaiting = [],
  forceEnabled = false,
}: {
  initialWaiting?: WaitingItem[];
  /** true en /estacion: siempre vigila aunque el flag aún no esté en localStorage */
  forceEnabled?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [stationMode, setStationMode] = useState(false);
  const [waiting, setWaiting] = useState<WaitingItem[]>(initialWaiting);
  const [pending, setPending] = useState<WaitingItem | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);
  const [authLost, setAuthLost] = useState(false);
  const [navFailed, setNavFailed] = useState<WaitingItem | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const navigatingRef = useRef(false);
  const pendingIdRef = useRef<number | null>(null);

  const onEstacionSection = pathname === "/estacion" || pathname.startsWith("/estacion/");
  const onSala = pathname.startsWith("/estacion/sala/");
  const currentSalaId = onSala
    ? Number(pathname.split("/estacion/sala/")[1]?.split(/[/?#]/)[0])
    : null;
  const active = forceEnabled || stationMode || onEstacionSection;

  // Activar modo estación al tocar cualquier ruta /estacion*
  useEffect(() => {
    if (onEstacionSection) {
      enableStationMode();
      setStationMode(true);
      console.info("[station-autopilot] station mode ON (visited", pathname, ")");
    } else {
      setStationMode(readStationMode());
    }
  }, [onEstacionSection, pathname]);

  // Arranque inmediato con SSR data
  useEffect(() => {
    if (!active || navigatingRef.current) return;
    const opened = new Set(readOpened());
    const first = initialWaiting.find((item) => {
      if (opened.has(item.appointmentId)) return false;
      if (currentSalaId === item.appointmentId) return false;
      return true;
    });
    if (first) {
      console.info("[station-autopilot] initial waiting → pending", first.appointmentId);
      setPending((prev) => prev ?? first);
    }
  }, [active, initialWaiting, currentSalaId]);

  // Poll cola
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/station/waiting", { cache: "no-store" });
        if (cancelled) return;

        if (res.status === 401) {
          setAuthLost(true);
          setPollError("Sesión expirada");
          console.warn("[station-autopilot] waiting API 401 — session lost");
          return;
        }
        if (!res.ok) {
          setPollError(`Error cola (${res.status})`);
          return;
        }

        setAuthLost(false);
        setPollError(null);
        const data = (await res.json()) as { waiting?: WaitingItem[] };
        if (!data.waiting) return;
        setWaiting(data.waiting);

        const opened = new Set(readOpened());
        const candidate = data.waiting.find((item) => {
          if (opened.has(item.appointmentId)) return false;
          if (currentSalaId === item.appointmentId) return false;
          return true;
        });

        if (candidate && !navigatingRef.current) {
          // Ya en otra sala: cambiar de inmediato al paciente nuevo en espera.
          if (onSala && currentSalaId !== candidate.appointmentId) {
            console.info(
              "[station-autopilot] switching sala",
              currentSalaId,
              "→",
              candidate.appointmentId,
            );
            navigatingRef.current = true;
            goToSala(candidate.appointmentId);
            return;
          }
          if (!onSala) {
            console.info("[station-autopilot] poll → pending", candidate.appointmentId);
            setPending((prev) => prev ?? candidate);
          }
        }

        // Limpia IDs abiertos que ya no están en espera (permite re-autojoin el mismo día).
        const live = new Set(data.waiting.map((w) => w.appointmentId));
        const still = readOpened().filter((id) => live.has(id));
        try {
          sessionStorage.setItem(OPENED_KEY, JSON.stringify(still));
        } catch {
          /* ignore */
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
  }, [active, onSala, currentSalaId]);

  // Cuenta regresiva corta → hard navigate
  useEffect(() => {
    if (!pending || onSala || navigatingRef.current) return;
    if (!active) return;

    pendingIdRef.current = pending.appointmentId;
    setSecondsLeft(COUNTDOWN_SEC);
    setNavFailed(null);
    console.info("[station-autopilot] countdown start", pending.appointmentId);

    const tick = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          if (!navigatingRef.current && pendingIdRef.current === pending.appointmentId) {
            navigatingRef.current = true;
            goToSala(pending.appointmentId);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Si tras NAV_FAIL_MS seguimos en la misma ruta, banner de emergencia.
    const failTimer = window.setTimeout(() => {
      if (navigatingRef.current && pendingIdRef.current === pending.appointmentId) {
        const stillHere = window.location.pathname !== salaPath(pending.appointmentId);
        if (stillHere) {
          console.error("[station-autopilot] navigation failed", pending.appointmentId);
          navigatingRef.current = false;
          unmarkOpened(pending.appointmentId);
          setNavFailed(pending);
        }
      }
    }, NAV_FAIL_MS);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(failTimer);
    };
  }, [pending, onSala, active]);

  if (!active) return null;

  const showOverlay = Boolean(pending && !onSala);

  return (
    <>
      {/* Indicador permanente: modo estación activo en esta PC */}
      {!onSala && (
        <div className="pointer-events-none fixed bottom-3 left-3 z-[70] max-w-xs rounded-lg border border-[#1d6eb8]/40 bg-[#0f3d66]/95 px-3 py-2 text-xs text-white shadow-lg">
          <p className="font-semibold">Modo estación Dell activo</p>
          <p className="mt-0.5 text-white/80">
            Teleconsultas se abren solas aquí. No uses Agenda para el video del paciente.
          </p>
          <button
            type="button"
            className="pointer-events-auto mt-1 text-[11px] underline opacity-80 hover:opacity-100"
            onClick={() => {
              disableStationMode();
              setStationMode(false);
            }}
          >
            Desactivar en este navegador
          </button>
        </div>
      )}

      {pollError && !authLost && (
        <div className="fixed top-3 left-1/2 z-[75] w-[min(96vw,36rem)] -translate-x-1/2 rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-xl">
          <p className="font-semibold">Vigilancia de estación: {pollError}</p>
          <p className="mt-1">Reintentando cada {POLL_MS / 1000}s. Mantén esta PC en /estacion.</p>
        </div>
      )}

      {authLost && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-red-950/90 p-6"
          role="alertdialog"
          aria-live="assertive"
        >
          <div className="w-full max-w-lg rounded-2xl border-4 border-red-400 bg-white px-6 py-8 text-center shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-red-700">
              Sesión expirada — video bloqueado
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              Vuelve a iniciar sesión. Te regresamos a la sala de estación.
            </p>
            <a
              href={`/login?from=${encodeURIComponent(pending ? salaPath(pending.appointmentId) : "/estacion")}`}
              className="mt-6 inline-block rounded-lg bg-red-700 px-6 py-3 text-base font-bold text-white hover:bg-red-800"
            >
              Iniciar sesión ahora
            </a>
          </div>
        </div>
      )}

      {navFailed && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-red-950/90 p-6"
          role="alertdialog"
          aria-live="assertive"
        >
          <div className="w-full max-w-lg rounded-2xl border-4 border-red-400 bg-white px-6 py-8 text-center shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-red-700">
              Falló apertura automática
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">{navFailed.patientName}</h2>
            <p className="mt-1 text-sm text-slate-500">Expediente {navFailed.chartNumber}</p>
            <a
              href={salaPath(navFailed.appointmentId)}
              className="mt-6 inline-block w-full rounded-lg bg-red-700 px-6 py-4 text-lg font-bold text-white hover:bg-red-800"
              onClick={() => {
                navigatingRef.current = true;
                markOpened(navFailed.appointmentId);
              }}
            >
              ABRIR VIDEOCONSULTA AHORA
            </a>
          </div>
        </div>
      )}

      {showOverlay && pending && !navFailed && !authLost && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-6"
          role="alertdialog"
          aria-live="assertive"
          aria-label="Teleconsulta lista"
        >
          <div className="w-full max-w-lg rounded-2xl border-2 border-amber-400 bg-white px-6 py-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Teleconsulta automática — PC estación
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">{pending.patientName}</h2>
            <p className="mt-1 text-sm text-slate-500">Expediente {pending.chartNumber}</p>
            {pending.summary ? (
              <p className="mt-4 text-sm text-slate-600 line-clamp-3">{pending.summary}</p>
            ) : null}
            {pending.redFlags.length > 0 ? (
              <p className="mt-3 text-sm font-medium text-amber-900">
                {pending.redFlags.slice(0, 4).join(" · ")}
              </p>
            ) : null}
            {!pending.meetingUrl ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Sala Daily pendiente — se creará al abrir.
              </p>
            ) : (
              <p className="mt-3 text-sm text-emerald-700">Sala Daily lista</p>
            )}
            <p className="mt-6 text-xl font-semibold text-[#1a4d7c]">
              Abriendo videoconsulta en {secondsLeft}…
            </p>
            <a
              href={salaPath(pending.appointmentId)}
              className="mt-6 inline-block rounded-lg bg-[#1d6eb8] px-6 py-3 text-base font-bold text-white hover:bg-[#185a96]"
              onClick={() => {
                navigatingRef.current = true;
                markOpened(pending.appointmentId);
              }}
            >
              Abrir ahora
            </a>
            <p className="mt-4 text-xs text-slate-400">
              Esta PC Dell es el lado paciente. El médico remoto se une desde su notificación /
              consulta. No abras Agenda en esta PC para el video.
            </p>
          </div>
        </div>
      )}

      {!showOverlay && !navFailed && !authLost && waiting.length > 0 && !onSala && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            {waiting.length} paciente{waiting.length === 1 ? "" : "s"} en espera de teleconsulta
          </p>
          <p className="mt-1">
            Modo estación vigila cada {POLL_MS / 1000}s y abre la sala sola. Cola:{" "}
            {waiting.map((w) => w.patientName).join(", ")}.
          </p>
          <a
            href={salaPath(waiting[0].appointmentId)}
            className="mt-2 inline-block font-bold text-amber-950 underline"
          >
            Abrir sala de {waiting[0].patientName} ahora
          </a>
        </div>
      )}
    </>
  );
}
