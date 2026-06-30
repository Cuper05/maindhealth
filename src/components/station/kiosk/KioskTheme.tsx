import type { KioskStep } from "@/lib/db/schema/station-kiosk";

export const KIOSK_STEP_ORDER: KioskStep[] = [
  "welcome",
  "identification",
  "registration",
  "clinical",
  "preparation",
  "blood_pressure",
  "oxygen",
  "weight_height",
  "temperature",
  "summary",
  "waiting",
  "consultation",
];

export const KIOSK_STEP_SHORT: Record<KioskStep, string> = {
  welcome: "Bienvenida",
  identification: "Identificación",
  registration: "Datos",
  clinical: "Clínico",
  preparation: "Preparación",
  blood_pressure: "Presión",
  oxygen: "Oxígeno",
  weight_height: "Peso",
  temperature: "Temp.",
  summary: "Resumen",
  waiting: "Espera",
  consultation: "Consulta",
};

export const kioskInputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-[#1d6eb8] focus:outline-none focus:ring-2 focus:ring-[#1d6eb8]/20";

export const kioskLabelClassName = "mb-2 block text-sm font-medium text-slate-600";

export function KioskPrimaryButton({
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
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#1d6eb8] px-8 text-base font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#165a9e] active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
      <span aria-hidden className="text-lg">→</span>
    </button>
  );
}

export function KioskSecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
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
      className={`rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(15,45,90,0.06)] md:p-8 ${className}`}
    >
      {children}
    </section>
  );
}

export function KioskError({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold">
        !
      </span>
      {message}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "idle" | "waiting" | "reading" | "done" | "retry";
}) {
  const map = {
    idle: { label: "Listo", className: "bg-slate-100 text-slate-600" },
    waiting: { label: "Esperando lectura…", className: "bg-amber-50 text-amber-800" },
    reading: { label: "Lectura en proceso…", className: "bg-blue-50 text-blue-800" },
    done: { label: "Lectura recibida", className: "bg-emerald-50 text-emerald-800" },
    retry: { label: "Repita la medición", className: "bg-red-50 text-red-700" },
  } as const;
  const item = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${item.className}`}>
      {status === "done" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
          ✓
        </span>
      )}
      {status === "reading" && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      )}
      {item.label}
    </span>
  );
}
