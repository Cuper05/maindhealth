"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  /** Columnas máximas del trazo en vivo (primera pasada L→R). */
  liveWindow?: number;
  height?: number;
  className?: string;
  label?: string;
};

/**
 * Papel ECG rosa + trazo oscuro.
 * En vivo: dibuja la primera onda de izquierda a derecha y la deja fija
 * (sin borrar ni volver a barrer).
 * Al terminar: trazado completo de la lectura.
 */
export function EcgWaveform({
  samples,
  live = false,
  liveWindow = 280,
  height = 190,
  className = "",
  label = "Onda ECG",
}: EcgWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Primera pasada congelada (null = aún llenando). */
  const frozenRef = useRef<number[] | null>(null);
  const filledRef = useRef(0);
  const scaleRef = useRef({ min: 0, max: 1 });

  // Nueva lectura / detener vivo → soltar congelado.
  useEffect(() => {
    if (!live || samples.length === 0) {
      frozenRef.current = null;
      filledRef.current = 0;
    }
  }, [live, samples.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#ffe4ec";
      ctx.fillRect(0, 0, w, h);
      const minor = 8;
      const major = 40;
      ctx.strokeStyle = "rgba(233, 90, 120, 0.28)";
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
      ctx.strokeStyle = "rgba(200, 50, 80, 0.45)";
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
      return h - 8 - t * (h - 16);
    };

    const updateScale = (vals: number[]) => {
      if (!vals.length) return;
      let min = vals[0]!;
      let max = vals[0]!;
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const span = max - min;
      const pad = Math.max(span * 0.15, span < 8 ? 40 : 12);
      min -= pad;
      max += pad;
      if (max - min < 20) {
        min -= 30;
        max += 30;
      }
      const prev = scaleRef.current;
      if (prev.max > prev.min + 1 && live && !frozenRef.current) {
        scaleRef.current = {
          min: prev.min * 0.85 + min * 0.15,
          max: prev.max * 0.85 + max * 0.15,
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
    ) => {
      const n = vals.length;
      if (!n) return;
      const xStep = n > 1 ? w / (n - 1) : w;
      ctx.beginPath();
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.85;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      vals.forEach((v, i) => {
        const x = i * xStep;
        const y = yAt(v, h, min, max);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
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
      drawGrid(ctx, w, h);

      if (!samples.length) {
        ctx.fillStyle = "#7f1d1d";
        ctx.font = "600 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          live ? "Esperando onda del MD100C_P…" : "Sin trazado aún",
          w / 2,
          h / 2,
        );
        return;
      }

      // ——— Modo final: trazado completo ———
      if (!live) {
        updateScale(samples);
        const { min, max } = scaleRef.current;
        strokeTrace(ctx, samples, w, h, min, max);
        return;
      }

      // ——— Modo vivo: primera pasada L→R y se congela ———
      const cols = Math.max(80, Math.min(liveWindow, Math.floor(w)));

      if (samples.length < filledRef.current) {
        // Nueva captura: reinicia.
        frozenRef.current = null;
        filledRef.current = 0;
      }

      if (!frozenRef.current) {
        const slice = samples.slice(0, cols);
        filledRef.current = samples.length;
        updateScale(slice);
        if (slice.length >= cols) {
          frozenRef.current = slice.slice();
        }
        const { min, max } = scaleRef.current;
        // Dibuja solo lo acumulado (crece L→R; no borra ni da la vuelta).
        const drawW =
          slice.length > 1 ? (w * (slice.length - 1)) / (cols - 1) : 0;
        strokeTrace(ctx, slice, Math.max(drawW, 1), h, min, max);

        if (slice.length) {
          const x =
            slice.length > 1 ? ((slice.length - 1) / (cols - 1)) * w : 0;
          const last = slice[slice.length - 1]!;
          ctx.beginPath();
          ctx.fillStyle = "#dc143c";
          ctx.arc(x, yAt(last, h, min, max), 4, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      // Primera onda ya completa: se queda fija.
      updateScale(frozenRef.current);
      const { min, max } = scaleRef.current;
      strokeTrace(ctx, frozenRef.current, w, h, min, max);
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [samples, height, live, liveWindow]);

  return (
    <div
      ref={wrapRef}
      className={`shrink-0 overflow-hidden rounded-2xl border-2 border-rose-300 bg-[#ffe4ec] shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-rose-300/70 bg-white/50 px-3 py-1.5">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-950 xl:text-base">
          {label}
        </p>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-900">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
            En vivo
          </span>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
