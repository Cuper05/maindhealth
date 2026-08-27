"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KioskStep } from "@/lib/db/schema/station-kiosk";

export const KIOSK_STEP_ORDER: KioskStep[] = [
  "welcome",
  "service",
  "payment",
  "identification",
  "registration",
  "symptoms",
  "antecedents",
  "consent",
  "preparation",
  "weight_height",
  "blood_pressure",
  "oxygen",
  "temperature",
  "ecg",
  "summary",
  "analysis",
  "result",
  "waiting",
  "consultation",
];

export const KIOSK_STEP_SHORT: Record<KioskStep, string> = {
  welcome: "Bienvenida",
  service: "Servicio",
  payment: "Pago",
  identification: "Identificación",
  registration: "Datos",
  symptoms: "Síntomas",
  antecedents: "Antecedentes",
  consent: "Consentimiento",
  clinical: "Clínico",
  preparation: "Preparación",
  weight_height: "Peso",
  blood_pressure: "Presión",
  oxygen: "Oxígeno",
  temperature: "Temp.",
  ecg: "ECG",
  summary: "Resumen",
  analysis: "Revisión",
  result: "Resultado",
  waiting: "Médico",
  consultation: "Consulta",
};

/** Todos los pasos pueden necesitar scroll; KioskScrollArea avisa si hace falta. */
export const KIOSK_SCROLL_ALLOWED_STEPS: KioskStep[] = [...KIOSK_STEP_ORDER];

/**
 * Escala fija intermedia-grande para kiosco táctil (ViewSonic):
 * - Texto/botones grandes a ~60–80 cm
 * - Sin text-5xl en listas (eso corta contenido)
 * - Si no cabe: scroll + CTA sticky, no achicar tipografía
 */
export const kioskTitleClassName =
  "text-3xl font-bold leading-tight tracking-tight text-slate-900 xl:text-4xl";

export const kioskSubtitleClassName =
  "mt-1.5 text-xl leading-snug text-slate-700 xl:text-2xl";

export const kioskBodyClassName = "text-xl leading-snug text-slate-700 xl:text-2xl";

export const kioskHelperClassName = "text-lg text-slate-500 xl:text-xl";

export const kioskLabelClassName =
  "mb-1.5 block text-lg font-semibold text-slate-700 xl:text-xl";

export const kioskInputClassName =
  "w-full min-h-[56px] rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-xl text-slate-900 shadow-sm transition focus:border-[#1d6eb8] focus:outline-none focus:ring-2 focus:ring-[#1d6eb8]/20 xl:min-h-[64px] xl:text-2xl";

/** Chips de síntomas / sí-no: grandes al tacto, caben en filas con wrap. */
export const kioskChipClassName =
  "min-h-[56px] rounded-xl px-4 py-2.5 text-lg font-semibold xl:min-h-[64px] xl:text-xl";

export function KioskPrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
  form,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[72px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1d6eb8] px-5 py-3 text-2xl font-bold leading-tight text-white shadow-md shadow-blue-900/10 transition hover:bg-[#165a9e] active:scale-[0.99] disabled:opacity-50 xl:min-h-[80px] xl:text-3xl ${className}`}
    >
      {children}
      <span aria-hidden className="text-2xl xl:text-3xl">
        →
      </span>
    </button>
  );
}

export function KioskSecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[64px] items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-5 py-3 text-xl font-bold leading-tight text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 xl:min-h-[72px] xl:text-2xl ${className}`}
    >
      {children}
    </button>
  );
}

export function KioskCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_40px_rgba(15,45,90,0.08)] sm:p-5 xl:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function KioskError({ message }: { message: string }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-xl font-semibold leading-snug text-red-900">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-base font-bold text-white">
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

export function KioskImportant({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-xl leading-snug text-amber-950 ${className}`}
    >
      {title ? <p className="mb-1 font-bold text-amber-900">{title}</p> : null}
      {children}
    </div>
  );
}

export function KioskInfo({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border-2 border-[#1d6eb8]/40 bg-[#f0f7ff] px-4 py-3 text-xl leading-snug text-slate-800 ${className}`}
    >
      {children}
    </div>
  );
}

export function KioskScrollArea({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setNeedsScroll(el.scrollHeight > el.clientHeight + 8);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {needsScroll ? (
        <p className="mb-2 shrink-0 rounded-xl border-2 border-[#1d6eb8]/50 bg-[#e8f2fc] px-4 py-2.5 text-center text-lg font-bold text-[#0b4f8a] xl:text-xl">
          Deslice hacia abajo para ver todas las opciones ↓
        </p>
      ) : null}
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {children}
      </div>
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "idle" | "waiting" | "reading" | "done" | "retry";
}) {
  const map = {
    idle: { label: "Listo", className: "bg-slate-100 text-slate-700" },
    waiting: { label: "Esperando lectura…", className: "bg-amber-100 text-amber-900" },
    reading: { label: "Lectura en curso…", className: "bg-blue-100 text-blue-900" },
    done: { label: "Lectura recibida", className: "bg-emerald-100 text-emerald-900" },
    retry: { label: "Repita la medición", className: "bg-red-100 text-red-800" },
  } as const;
  const item = map[status] ?? map.idle;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold ${item.className}`}
    >
      {status === "done" && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
          ✓
        </span>
      )}
      {status === "reading" && (
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
      )}
      {item.label}
    </span>
  );
}
