"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  height?: number;
  className?: string;
  label?: string;
};

/**
 * Papel ECG rosa + trazo oscuro (como la app ChoiceMMed).
 * Muestras uint16 ya decodificadas (LO|HI<<8), no bytes sueltos.
 */
export function EcgWaveform({
  samples,
  live = false,
  height = 190,
  className = "",
  label = "Onda ECG",
}: EcgWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

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

      // Fondo papel ECG (rosa claro).
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

      let min = samples[0]!;
      let max = samples[0]!;
      for (const v of samples) {
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

      const n = samples.length;
      const xStep = n > 1 ? w / (n - 1) : w;
      const yAt = (v: number) => {
        const t = (v - min) / (max - min || 1);
        return h - 8 - t * (h - 16);
      };

      // Trazo oscuro como la app del aparato.
      ctx.beginPath();
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.75;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      samples.forEach((v, i) => {
        const x = i * xStep;
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      if (live) {
        const last = samples[n - 1]!;
        ctx.beginPath();
        ctx.fillStyle = "#dc143c";
        ctx.arc((n - 1) * xStep, yAt(last), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [samples, height, live]);

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
