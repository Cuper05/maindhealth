"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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

const STORAGE_KEY = "maindhealth:station-auto-opened";
const COUNTDOWN_SEC = 3;
const POLL_MS = 3000;

function readOpened(): number[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function markOpened(appointmentId: number) {
  const next = [...new Set([...readOpened(), appointmentId])];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * En la PC Dell (/estacion): sondea la cola de teleconsulta y abre la sala
 * automáticamente cuando aparece un paciente nuevo en espera.
 *
 * Tradeoff: agresivo — si el staff está revisando otra cosa en /estacion,
 * la navegación a la sala interrumpe. Es intencional para “cero pasos manuales”.
 * No auto-navega si ya estás en /estacion/sala/* (evita bucles).
 */
export function StationTeleconsultaAutoPilot({
  initialWaiting = [],
}: {
  initialWaiting?: WaitingItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [waiting, setWaiting] = useState<WaitingItem[]>(initialWaiting);
  const [pending, setPending] = useState<WaitingItem | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);
  const navigatingRef = useRef(false);

  const onStationHome = pathname === "/estacion";
  const onSala = pathname?.startsWith("/estacion/sala/") ?? false;

  // Si al cargar /estacion ya hay pacientes en espera, arrancar cuenta regresiva de inmediato.
  useEffect(() => {
    if (!onStationHome || navigatingRef.current) return;
    const opened = new Set(readOpened());
    const first = initialWaiting.find((item) => !opened.has(item.appointmentId));
    if (first) {
      setPending((prev) => prev ?? first);
    }
  }, [onStationHome, initialWaiting]);

  useEffect(() => {
    if (!onStationHome && !onSala) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/station/waiting", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { waiting?: WaitingItem[] };
        if (cancelled || !data.waiting) return;
        setWaiting(data.waiting);

        const opened = new Set(readOpened());
        for (const item of data.waiting) {
          if (opened.has(item.appointmentId)) continue;
          // Solo auto-abrir cuando estamos en /estacion (cola), no desde otras rutas.
          if (onStationHome && !navigatingRef.current) {
            setPending((prev) => prev ?? item);
            break;
          }
        }

        // Limpia IDs abiertos que ya no están en espera (nueva visita del mismo día).
        const live = new Set(data.waiting.map((w) => w.appointmentId));
        const still = readOpened().filter((id) => live.has(id));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(still));
      } catch {
        /* ignore poll errors */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onStationHome, onSala]);

  useEffect(() => {
    if (!pending || !onStationHome || navigatingRef.current) return;

    setSecondsLeft(COUNTDOWN_SEC);
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          if (!navigatingRef.current) {
            navigatingRef.current = true;
            markOpened(pending.appointmentId);
            router.push(`/estacion/sala/${pending.appointmentId}`);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [pending, onStationHome, router]);

  if (!onStationHome) return null;

  if (pending) {
    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-6"
        role="alertdialog"
        aria-live="assertive"
        aria-label="Teleconsulta lista"
      >
        <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white px-6 py-8 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Teleconsulta automática
          </p>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            {pending.patientName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Expediente {pending.chartNumber}</p>
          {pending.summary ? (
            <p className="mt-4 text-sm text-slate-600 line-clamp-3">{pending.summary}</p>
          ) : null}
          {!pending.meetingUrl ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Sala Daily pendiente — se intentará crear al abrir.
            </p>
          ) : (
            <p className="mt-3 text-sm text-emerald-700">Sala Daily lista</p>
          )}
          <p className="mt-6 text-lg font-semibold text-[#1a4d7c]">
            Abriendo videoconsulta en {secondsLeft}…
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="rounded-lg bg-[#1d6eb8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#185a96]"
              onClick={() => {
                navigatingRef.current = true;
                markOpened(pending.appointmentId);
                router.push(`/estacion/sala/${pending.appointmentId}`);
              }}
            >
              Abrir ahora
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                markOpened(pending.appointmentId);
                setPending(null);
                navigatingRef.current = false;
              }}
            >
              Posponer (queda en cola)
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Esta PC Dell es el lado paciente. El médico remoto se une desde su consulta.
          </p>
        </div>
      </div>
    );
  }

  if (waiting.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">
        {waiting.length} paciente{waiting.length === 1 ? "" : "s"} en espera de teleconsulta
      </p>
      <p className="mt-1">
        La sala se abre sola en esta PC cuando llega un caso nuevo. Cola actualizada cada {POLL_MS / 1000}s.
      </p>
    </div>
  );
}
