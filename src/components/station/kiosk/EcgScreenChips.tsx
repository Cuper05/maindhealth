"use client";

import {
  ECG_SCREEN_DISCLAIMER,
  parseEcgFlagsCsv,
  type EcgScreenFlag,
  type EcgWaveQuality,
} from "@/lib/kiosk/ecg-wave-screen";

const FLAG_LABEL: Record<EcgScreenFlag, string> = {
  poor_signal: "Señal insuficiente",
  bradycardia: "Posible bradicardia (< 60 lpm)",
  tachycardia: "Posible taquicardia (> 100 lpm)",
  irregular: "Ritmo irregular",
  possible_af: "Sospecha irregularidad tipo FA",
  hr_mismatch: "FC trazado ≠ oxímetro",
};

function qualityTone(q?: string | null) {
  if (q === "good") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (q === "fair") return "border-amber-300 bg-amber-50 text-amber-950";
  if (q === "poor") return "border-rose-300 bg-rose-50 text-rose-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function flagTone(flag: EcgScreenFlag) {
  if (flag === "poor_signal") return "border-slate-300 bg-white text-slate-800";
  return "border-amber-400 bg-amber-50 text-amber-950";
}

export function EcgScreenChips({
  quality,
  flagsCsv,
  estimatedHr,
  compact = false,
}: {
  quality?: string | null;
  flagsCsv?: string | null;
  estimatedHr?: string | null;
  compact?: boolean;
}) {
  const flags = parseEcgFlagsCsv(flagsCsv);
  const q = (quality ?? "") as EcgWaveQuality | "";
  if (!q && !flags.length && !estimatedHr) return null;

  return (
    <div className={`shrink-0 space-y-2 ${compact ? "" : "rounded-2xl border border-rose-200/80 bg-white/80 px-3 py-2.5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {q ? (
          <span
            className={`rounded-lg border px-2.5 py-1 text-sm font-bold ${qualityTone(q)}`}
          >
            Calidad: {q === "good" ? "buena" : q === "fair" ? "aceptable" : "mala"}
          </span>
        ) : null}
        {estimatedHr ? (
          <span className="rounded-lg border border-[#1d6eb8]/30 bg-[#f0f7ff] px-2.5 py-1 text-sm font-bold text-[#0b4f8a]">
            FC estimada ~{estimatedHr} lpm
          </span>
        ) : null}
        {flags.map((f) => (
          <span
            key={f}
            className={`rounded-lg border px-2.5 py-1 text-sm font-bold ${flagTone(f)}`}
          >
            {FLAG_LABEL[f]}
          </span>
        ))}
      </div>
      <p className="text-xs font-medium leading-snug text-slate-600 xl:text-sm">
        {ECG_SCREEN_DISCLAIMER}
      </p>
    </div>
  );
}
