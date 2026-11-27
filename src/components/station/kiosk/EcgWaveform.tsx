"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  /** Columnas del barrido en vivo (~ancho del monitor). */
  liveWindow?: number;
  /** Ancho de la “borra” delante del cursor (px/columnas). */
  eraseGap?: number;
  height?: number;
  className?: string;
  label?: string;
};

/**
 * Papel ECG rosa + trazo oscuro.
 * En vivo: barrido tipo monitor de signos vitales (la onda pasa L→R y la borra limpia delante).
 * Al terminar: trazado completo de la lectura.
 */
export function EcgWaveform({
  samples,
  live = false,
  liveWindow = 280,
  eraseGap = 18,
  height = 190,
  className = "",
  label = "Onda ECG",
}: EcgWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Buffer circular de columnas (NaN = vacío / borrado). */
  const sweepRef = useRef<number[]>([]);
  const writeRef = useRef(0);
  const seenRef = useRef(0);
  const scaleRef = useRef({ min: 0, max: 1 });

  // Reset del barrido al iniciar/detener vivo o vaciar muestras.
  useEffect(() => {
    if (!live || samples.length === 0) {
      sweepRef.current = [];
      writeRef.current = 0;
      seenRef.current = 0;
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
        if (Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      const span = max - min;
      const pad = Math.max(span * 0.15, span < 8 ? 40 : 12);
      min -= pad;
      max += pad;
      if (max - min < 20) {
        min -= 30;
        max += 30;
      }
      // Suaviza el zoom para que no “salte” en vivo.
      const prev = scaleRef.current;
      if (prev.max > prev.min + 1 && live) {
        scaleRef.current = {
          min: prev.min * 0.85 + min * 0.15,
          max: prev.max * 0.85 + max * 0.15,
        };
      } else {
        scaleRef.current = { min, max };
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
        const n = samples.length;
        const xStep = n > 1 ? w / (n - 1) : w;
        ctx.beginPath();
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1.75;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        samples.forEach((v, i) => {
          const x = i * xStep;
          const y = yAt(v, h, min, max);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        return;
      }

      // ——— Modo vivo: barrido L→R con borra delante del cursor ———
      const cols = Math.max(80, Math.min(liveWindow, Math.floor(w)));
      if (sweepRef.current.length !== cols) {
        sweepRef.current = Array.from({ length: cols }, () => Number.NaN);
        writeRef.current = 0;
        seenRef.current = 0;
      }

      const buf = sweepRef.current;
      const prevSeen = seenRef.current;
      if (samples.length < prevSeen) {
        // Nueva lectura.
        buf.fill(Number.NaN);
        writeRef.current = 0;
        seenRef.current = 0;
      }

      const fresh = samples.slice(seenRef.current);
      seenRef.current = samples.length;

      if (fresh.length) {
        updateScale(fresh.length >= 8 ? fresh : samples.slice(-Math.min(samples.length, 60)));
      }

      const gap = Math.max(8, Math.min(eraseGap, Math.floor(cols * 0.08)));
      for (const v of fresh) {
        const wi = writeRef.current % cols;
        buf[wi] = v;
        // Borra delante del cursor (hueco del monitor).
        for (let g = 1; g <= gap; g++) {
          buf[(wi + g) % cols] = Number.NaN;
        }
        writeRef.current = (wi + 1) % cols;
      }

      const { min, max } = scaleRef.current;
      const xStep = cols > 1 ? w / (cols - 1) : w;

      // Dibuja segmentos continuos (salta NaN = borra).
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.85;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      let drawing = false;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const v = buf[i]!;
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

      // Cursor / punta de la onda.
      const cursorCol = (writeRef.current - 1 + cols) % cols;
      const cursorX = cursorCol * xStep;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(220, 20, 60, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, h);
      ctx.stroke();
      const cv = buf[cursorCol];
      if (Number.isFinite(cv)) {
        ctx.beginPath();
        ctx.fillStyle = "#dc143c";
        ctx.arc(cursorX, yAt(cv!, h, min, max), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [samples, height, live, liveWindow, eraseGap]);

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
            En vivo · barrido
          </span>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
