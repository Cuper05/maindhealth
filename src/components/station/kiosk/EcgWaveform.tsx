"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  /** Columnas fijas del barrido en vivo. */
  liveWindow?: number;
  height?: number;
  className?: string;
  label?: string;
};

/** Suaviza ligero para monitor (no altera el cribado). */
function softenMonitorWave(pts: number[], window = 5): number[] {
  if (pts.length < 3) return pts.slice();
  const half = Math.floor(window / 2);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < pts.length) {
        s += pts[j]!;
        n += 1;
      }
    }
    out.push(s / n);
  }
  return out;
}

function rangeOf(vals: number[]): { min: number; max: number } | null {
  if (!vals.length) return null;
  let min = vals[0]!;
  let max = vals[0]!;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/**
 * Monitor ECG:
 * - Escala Y se fija al inicio y no vuelve a cambiar en vivo.
 * - Barrido: nuevas a la derecha, viejas salen por la izquierda.
 * - Al terminar: onda completa.
 */
export function EcgWaveform({
  samples,
  live = false,
  liveWindow = 240,
  height = 190,
  className = "",
  label = "Onda ECG",
}: EcgWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<{ min: number; max: number; locked: boolean }>({
    min: 0,
    max: 1,
    locked: false,
  });
  const seenLenRef = useRef(0);

  useEffect(() => {
    if (samples.length === 0) {
      scaleRef.current = { min: 0, max: 1, locked: false };
      seenLenRef.current = 0;
    }
  }, [samples.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const cols = Math.max(120, liveWindow);

    const drawMonitorBg = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
    ) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#071a16");
      g.addColorStop(1, "#020806");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const minor = 16;
      const major = 64;
      ctx.strokeStyle = "rgba(34, 197, 94, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += minor) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += minor) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(34, 197, 94, 0.28)";
      for (let x = 0; x <= w; x += major) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += major) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
    };

    const yAt = (v: number, h: number, min: number, max: number) => {
      const t = (v - min) / (max - min || 1);
      return h - 10 - t * (h - 20);
    };

    /** Fija la escala UNA vez con las primeras muestras de la lectura. */
    const lockScaleFromStart = (all: number[]) => {
      if (scaleRef.current.locked) return;
      // Usa solo el tramo inicial (no la ventana deslizante).
      const seed = softenMonitorWave(all.slice(0, Math.min(48, all.length)));
      const r = rangeOf(seed);
      if (!r) return;
      const span = Math.max(r.max - r.min, 30);
      const pad = Math.max(span * 0.55, 50);
      let min = r.min - pad;
      let max = r.max + pad;
      if (max - min < 100) {
        const mid = (min + max) / 2;
        min = mid - 50;
        max = mid + 50;
      }
      // Bloquea en cuanto hay señal útil; si aún hay muy poco, deja provisional.
      if (all.length >= 24) {
        scaleRef.current = { min, max, locked: true };
      } else {
        scaleRef.current = { min, max, locked: false };
      }
    };

    const strokeSeries = (
      ctx: CanvasRenderingContext2D,
      vals: number[],
      w: number,
      h: number,
      min: number,
      max: number,
      tip: boolean,
    ) => {
      const n = vals.length;
      if (!n) return;
      const xStep = n > 1 ? w / (n - 1) : 0;

      const paint = (width: number, color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        let drawing = false;
        for (let i = 0; i < n; i++) {
          const v = vals[i]!;
          if (!Number.isFinite(v)) {
            drawing = false;
            continue;
          }
          const x = i * xStep;
          const y = yAt(v, h, min, max);
          if (!drawing) {
            ctx.moveTo(x, y);
            drawing = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      };

      paint(4.5, "rgba(74, 222, 128, 0.28)");
      paint(2, "#4ade80");

      if (tip) {
        for (let i = n - 1; i >= 0; i--) {
          const v = vals[i]!;
          if (!Number.isFinite(v)) continue;
          ctx.beginPath();
          ctx.fillStyle = "#bbf7d0";
          ctx.arc(i * xStep, yAt(v, h, min, max), 3.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    };

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, wrap.clientWidth || 320);
      const h = height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMonitorBg(ctx, w, h);

      if (!samples.length) {
        ctx.fillStyle = "#86efac";
        ctx.font = "600 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          live ? "Esperando onda del MD100C_P…" : "Sin trazado aún",
          w / 2,
          h / 2,
        );
        return;
      }

      if (samples.length < seenLenRef.current) {
        scaleRef.current = { min: 0, max: 1, locked: false };
      }
      seenLenRef.current = samples.length;

      // Escala del inicio: no se recalcula con el barrido.
      lockScaleFromStart(samples);
      const { min, max } = scaleRef.current;

      if (live) {
        // Buffer fijo de `cols`: nuevas a la derecha, viejas salen a la izquierda.
        const raw = samples.slice(-cols);
        const soft = softenMonitorWave(raw);
        const pad = Math.max(0, cols - soft.length);
        const frame: number[] = [
          ...Array.from({ length: pad }, () => Number.NaN),
          ...soft,
        ];
        strokeSeries(ctx, frame, w, h, min, max, true);
        return;
      }

      // Terminado: onda completa (misma escala Y del inicio).
      const full = softenMonitorWave(samples);
      strokeSeries(ctx, full, w, h, min, max, false);
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [samples, height, live, liveWindow]);

  return (
    <div
      ref={wrapRef}
      className={`shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-800/80 bg-[#020806] shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-800/70 bg-emerald-950/60 px-3 py-1.5">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-100 xl:text-base">
          {label}
        </p>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Barrido · ←
          </span>
        ) : (
          <span className="text-sm font-semibold text-emerald-500/90">
            Onda completa
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
