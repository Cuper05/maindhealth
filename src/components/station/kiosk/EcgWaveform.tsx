"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  /** Muestras de la “primera onda” (ancho tipo monitor). */
  liveWindow?: number;
  height?: number;
  className?: string;
  label?: string;
};

/** Suaviza para vista tipo monitor (no altera el cribado). */
function softenMonitorWave(
  pts: number[],
  opts?: { window?: number; upsample?: boolean },
): number[] {
  if (pts.length < 3) return pts.slice();
  const window = opts?.window ?? 7;
  const half = Math.floor(window / 2);
  const avg: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < pts.length) {
        s += pts[j]!;
        n += 1;
      }
    }
    avg.push(s / n);
  }
  if (!opts?.upsample || avg.length < 40) return avg;
  // Upsample suave (coseno) para que el trazo no se vea dentado.
  const out: number[] = [];
  const target = Math.min(avg.length * 2, 560);
  for (let i = 0; i < target; i++) {
    const t = (i / (target - 1)) * (avg.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, avg.length - 1);
    const frac = t - i0;
    const mu = (1 - Math.cos(frac * Math.PI)) / 2;
    out.push(avg[i0]! * (1 - mu) + avg[i1]! * mu);
  }
  return out;
}

/**
 * Vista tipo monitor de signos vitales.
 * Solo la primera pasada (no el trazado completo comprimido/picudo).
 * En vivo crece L→R y se congela; al terminar sigue esa misma onda.
 */
export function EcgWaveform({
  samples,
  live = false,
  liveWindow = 220,
  height = 190,
  className = "",
  label = "Onda ECG",
}: EcgWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Primera onda congelada (ya suavizada). */
  const frozenRef = useRef<number[] | null>(null);
  const filledRef = useRef(0);
  const scaleRef = useRef({ min: 0, max: 1 });

  // Solo reinicia al vaciar muestras (nueva lectura).
  // Al terminar live NO se suelta: se queda la primera onda.
  useEffect(() => {
    if (samples.length === 0) {
      frozenRef.current = null;
      filledRef.current = 0;
    }
  }, [samples.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

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

    const updateScale = (vals: number[], soft: boolean) => {
      if (!vals.length) return;
      let min = vals[0]!;
      let max = vals[0]!;
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const span = max - min;
      const pad = Math.max(span * 0.22, span < 8 ? 40 : 16);
      min -= pad;
      max += pad;
      if (max - min < 24) {
        min -= 30;
        max += 30;
      }
      const prev = scaleRef.current;
      if (soft && prev.max > prev.min + 1) {
        scaleRef.current = {
          min: prev.min * 0.8 + min * 0.2,
          max: prev.max * 0.8 + max * 0.2,
        };
      } else {
        scaleRef.current = { min, max };
      }
    };

    const strokeTrace = (
      ctx: CanvasRenderingContext2D,
      vals: number[],
      w: number,
      h: number,
      min: number,
      max: number,
      tip?: boolean,
    ) => {
      const n = vals.length;
      if (!n) return;
      const xStep = n > 1 ? w / (n - 1) : w;

      // Halo suave tipo fosforo de monitor.
      ctx.beginPath();
      ctx.strokeStyle = "rgba(74, 222, 128, 0.28)";
      ctx.lineWidth = 4.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      vals.forEach((v, i) => {
        const x = i * xStep;
        const y = yAt(v, h, min, max);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      vals.forEach((v, i) => {
        const x = i * xStep;
        const y = yAt(v, h, min, max);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      if (tip && n) {
        const x = (n - 1) * xStep;
        const y = yAt(vals[n - 1]!, h, min, max);
        ctx.beginPath();
        ctx.fillStyle = "#bbf7d0";
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const firstPassRaw = (src: number[], cols: number) =>
      src.slice(0, Math.min(cols, src.length));

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

      if (!samples.length && !frozenRef.current) {
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

      const cols = Math.max(80, Math.min(liveWindow, Math.floor(w * 0.55)));

      if (samples.length > 0 && samples.length < filledRef.current) {
        frozenRef.current = null;
        filledRef.current = 0;
      }

      // Congela la primera pasada suavizada (nunca el trazado largo/picudo).
      if (!frozenRef.current && samples.length > 0) {
        const raw = firstPassRaw(samples, cols);
        filledRef.current = samples.length;
        if (raw.length >= cols || (!live && raw.length >= 24)) {
          frozenRef.current = softenMonitorWave(raw, { upsample: true });
        }
      }

      const rawPass = firstPassRaw(samples, cols);
      const display = frozenRef.current
        ? frozenRef.current
        : softenMonitorWave(rawPass);

      if (!display.length) return;

      const filling = live && !frozenRef.current;
      updateScale(display, filling);
      const { min, max } = scaleRef.current;

      if (filling) {
        const progress = Math.min(
          1,
          rawPass.length / Math.max(cols - 1, 1),
        );
        const drawW = Math.max(progress * w, 2);
        strokeTrace(ctx, display, drawW, h, min, max, true);
      } else {
        strokeTrace(ctx, display, w, h, min, max, false);
      }
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
            Monitor
          </span>
        ) : (
          <span className="text-sm font-semibold text-emerald-500/90">
            Primera onda
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
