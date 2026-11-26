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
 * Trazado estilo ecg.py (matplotlib):
 * - eje Y fijo 40–180
 * - línea crimson con puntos
 * - últimos samples interpolados en el kiosko
 */
export function EcgWaveform({
  samples,
  live = false,
  height = 168,
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

      ctx.fillStyle = "#fff8f8";
      ctx.fillRect(0, 0, w, h);

      // Grilla como ax.grid(True) de ecg.py
      ctx.strokeStyle = "rgba(220, 20, 60, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      const yMin = 40;
      const yMax = 180;
      const yAt = (v: number) => {
        const clamped = Math.min(yMax, Math.max(yMin, v));
        const t = (clamped - yMin) / (yMax - yMin);
        return h - 10 - t * (h - 20);
      };

      if (!samples.length) {
        ctx.fillStyle = "#64748b";
        ctx.font = "600 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          live ? "Esperando onda del MD100C_P…" : "Sin trazado aún",
          w / 2,
          h / 2,
        );
        return;
      }

      const n = samples.length;
      const xStep = n > 1 ? w / (n - 1) : w;

      // Línea crimson (como color='crimson' en ecg.py)
      ctx.beginPath();
      ctx.strokeStyle = "#dc143c";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      samples.forEach((v, i) => {
        const x = i * xStep;
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Marcadores cada ~N puntos (marker='o' de matplotlib, sin saturar)
      const markEvery = Math.max(1, Math.floor(n / 28));
      ctx.fillStyle = "#dc143c";
      for (let i = 0; i < n; i += markEvery) {
        ctx.beginPath();
        ctx.arc(i * xStep, yAt(samples[i]!), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (live) {
        const last = samples[n - 1]!;
        ctx.beginPath();
        ctx.fillStyle = "#ea580c";
        ctx.arc((n - 1) * xStep, yAt(last), 5, 0, Math.PI * 2);
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
      className={`shrink-0 overflow-hidden rounded-2xl border-2 border-rose-300/70 bg-[#fff8f8] shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-rose-200/80 px-3 py-1.5">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-900 xl:text-base">
          {label}
        </p>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
            En vivo
          </span>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
