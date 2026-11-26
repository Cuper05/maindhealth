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
 * Trazado ECG/PPG en vivo (muestras 0–255 del MD100C_P).
 * Lienzo a pantalla completa del contenedor; reescala Y automáticamente.
 */
export function EcgWaveform({
  samples,
  live = false,
  height = 152,
  className = "",
  label = "Onda ECG",
}: EcgWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, wrap.clientWidth);
    const h = height;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fondo tipo papel ECG (suave, marca MaindHealth).
    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(0, 0, w, h);

    const major = 28;
    ctx.strokeStyle = "rgba(29, 110, 184, 0.12)";
    ctx.lineWidth = 1;
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
    ctx.strokeStyle = "rgba(29, 110, 184, 0.22)";
    for (let x = 0; x <= w; x += major * 5) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }

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

    let min = samples[0]!;
    let max = samples[0]!;
    for (const v of samples) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const pad = Math.max(4, (max - min) * 0.12);
    min -= pad;
    max += pad;
    if (max - min < 8) {
      min -= 4;
      max += 4;
    }

    const n = samples.length;
    const xStep = n > 1 ? w / (n - 1) : w;
    const yAt = (v: number) => {
      const t = (v - min) / (max - min || 1);
      return h - 8 - t * (h - 16);
    };

    ctx.beginPath();
    ctx.strokeStyle = "#0b4f8a";
    ctx.lineWidth = 2.25;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    samples.forEach((v, i) => {
      const x = i * xStep;
      const y = yAt(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Punto vivo al final del trazo.
    if (live) {
      const last = samples[n - 1]!;
      const x = (n - 1) * xStep;
      const y = yAt(last);
      ctx.beginPath();
      ctx.fillStyle = "#ea580c";
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [samples, height, live]);

  return (
    <div
      ref={wrapRef}
      className={`overflow-hidden rounded-2xl border-2 border-[#1d6eb8]/35 bg-[#f7fbff] shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#1d6eb8]/15 px-3 py-1.5">
        <p className="text-sm font-bold uppercase tracking-wide text-[#0b4f8a] xl:text-base">
          {label}
        </p>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            En vivo
          </span>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
