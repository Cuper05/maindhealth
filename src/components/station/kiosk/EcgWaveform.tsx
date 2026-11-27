"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  /** Columnas del barrido en vivo (fijas → scroll continuo). */
  liveWindow?: number;
  height?: number;
  className?: string;
  label?: string;
};

/** Suavizado ligero y estable (misma receta siempre). */
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
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of vals) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/** Downsample uniforme para la onda completa (misma densidad visual que el vivo). */
function downsampleEven(pts: number[], target: number): number[] {
  if (pts.length <= target) return pts;
  const out: number[] = [];
  const last = pts.length - 1;
  for (let i = 0; i < target; i++) {
    const idx = Math.round((i / (target - 1)) * last);
    out.push(pts[idx]!);
  }
  return out;
}

/**
 * Monitor ECG continuo:
 * - Mismo modo de dibujo siempre (no cambia de “gráfica” a mitad).
 * - Escala Y según las mediciones visibles (suave, sin saltos bruscos).
 * - Vivo: scroll derecha→izquierda. Fin: onda completa.
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
  const scaleRef = useRef({ min: 0, max: 1, ready: false });
  const seenLenRef = useRef(0);

  useEffect(() => {
    if (samples.length === 0) {
      scaleRef.current = { min: 0, max: 1, ready: false };
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

    /** Escala según las mediciones actuales (EMA suave, sin bloqueo al inicio). */
    const autoscale = (vals: number[]) => {
      const r = rangeOf(vals);
      if (!r) return;
      const span = Math.max(r.max - r.min, 20);
      const pad = Math.max(span * 0.25, 18);
      let min = r.min - pad;
      let max = r.max + pad;
      if (max - min < 60) {
        const mid = (min + max) / 2;
        min = mid - 30;
        max = mid + 30;
      }

      const prev = scaleRef.current;
      if (!prev.ready) {
        scaleRef.current = { min, max, ready: true };
        return;
      }
      // Sigue las mediciones con suavizado (sube más rápido que baja).
      const up = 0.35;
      const down = 0.12;
      const nextMin =
        min < prev.min
          ? prev.min * (1 - up) + min * up
          : prev.min * (1 - down) + min * down;
      const nextMax =
        max > prev.max
          ? prev.max * (1 - up) + max * up
          : prev.max * (1 - down) + max * down;
      scaleRef.current = { min: nextMin, max: nextMax, ready: true };
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
        scaleRef.current = { min: 0, max: 1, ready: false };
      }
      seenLenRef.current = samples.length;

      // Misma tubería siempre: suavizar → ventana o completa → autoscale → trazo.
      let frame: number[];
      if (live) {
        const soft = softenMonitorWave(samples.slice(-cols));
        const pad = Math.max(0, cols - soft.length);
        frame = [
          ...Array.from({ length: pad }, () => Number.NaN),
          ...soft,
        ];
      } else {
        // Completa, pero con densidad parecida al monitor (sin “otra gráfica” densa).
        const soft = softenMonitorWave(samples);
        frame = downsampleEven(soft, Math.min(soft.length, cols * 2));
      }

      autoscale(frame);
      const { min, max } = scaleRef.current;
      strokeSeries(ctx, frame, w, h, min, max, live);
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [samples, height, live, liveWindow]);

  return (
    <div
      ref={wrapRef}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-emerald-800/80 bg-[#020806] shadow-sm ${className || "shrink-0"}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-800/70 bg-emerald-950/60 px-3 py-1.5">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-100 xl:text-base">
          {label}
        </p>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Continuo · ←
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
