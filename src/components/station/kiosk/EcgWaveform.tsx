"use client";

import { useEffect, useRef } from "react";

type EcgWaveformProps = {
  samples: number[];
  live?: boolean;
  /** Ventana visible (~segundos de monitor). */
  liveWindow?: number;
  height?: number;
  className?: string;
  label?: string;
};

/** Suaviza para vista tipo monitor (no altera el cribado). */
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
 * Monitor de signos vitales:
 * - Escala Y fija (no “salta” de tamaño).
 * - Trazo nuevo entra por la derecha y la onda se desplaza a la izquierda.
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
  /** Escala Y bloqueada tras calibración. */
  const scaleRef = useRef<{ min: number; max: number; locked: boolean }>({
    min: 0,
    max: 1,
    locked: false,
  });
  /** Última ventana al terminar (se queda fija). */
  const lastViewRef = useRef<number[] | null>(null);
  const seenLenRef = useRef(0);

  useEffect(() => {
    if (samples.length === 0) {
      scaleRef.current = { min: 0, max: 1, locked: false };
      lastViewRef.current = null;
      seenLenRef.current = 0;
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

    /**
     * Calibra una vez con las primeras muestras y bloquea.
     * Solo amplía si algo se sale (nunca encoge → no “salta” el tamaño).
     */
    const ensureScale = (vals: number[]) => {
      const r = rangeOf(vals);
      if (!r) return;
      const pad = Math.max((r.max - r.min) * 0.35, 40);
      let min = r.min - pad;
      let max = r.max + pad;
      if (max - min < 80) {
        const mid = (min + max) / 2;
        min = mid - 40;
        max = mid + 40;
      }

      const cur = scaleRef.current;
      if (cur.locked) return; // escala fija: el tamaño de la onda ya no cambia
      // Espera un poco de señal antes de fijar.
      if (vals.length >= 36) {
        scaleRef.current = { min, max, locked: true };
      } else {
        scaleRef.current = { min, max, locked: false };
      }
    };

    const strokeTrace = (
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
      // Siempre el ancho completo del monitor (tamaño horizontal fijo).
      const xStep = n > 1 ? w / (n - 1) : 0;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(74, 222, 128, 0.28)";
      ctx.lineWidth = 4.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const x = i * xStep;
        const y = yAt(vals[i]!, h, min, max);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const x = i * xStep;
        const y = yAt(vals[i]!, h, min, max);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (tip) {
        const x = (n - 1) * xStep;
        const y = yAt(vals[n - 1]!, h, min, max);
        ctx.beginPath();
        ctx.fillStyle = "#bbf7d0";
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
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

      if (!samples.length && !lastViewRef.current) {
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

      const cols = Math.max(100, Math.min(liveWindow, Math.floor(w / 2.2)));

      if (samples.length > 0 && samples.length < seenLenRef.current) {
        scaleRef.current = { min: 0, max: 1, locked: false };
        lastViewRef.current = null;
      }
      seenLenRef.current = samples.length;

      let view: number[];
      if (live && samples.length) {
        // Ventana deslizante: lo más nuevo a la derecha → la onda “pasa” a la izquierda.
        const raw = samples.slice(-cols);
        view = softenMonitorWave(raw);
        lastViewRef.current = view;
      } else if (lastViewRef.current?.length) {
        view = lastViewRef.current;
      } else if (samples.length) {
        view = softenMonitorWave(samples.slice(-cols));
        lastViewRef.current = view;
      } else {
        return;
      }

      ensureScale(view);
      const { min, max } = scaleRef.current;

      // Si aún no llena la ventana, ancla el trazo a la derecha (entra por la derecha).
      if (live && view.length < cols) {
        const pad = cols - view.length;
        const padded = [
          ...Array.from({ length: pad }, () => Number.NaN),
          ...view,
        ];
        // Dibuja solo segmentos finitos (hueco a la izquierda).
        const xStep = cols > 1 ? w / (cols - 1) : 0;
        const { min: sMin, max: sMax } = scaleRef.current;

        const strokeFinite = (width: number, color: string) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          let drawing = false;
          for (let i = 0; i < padded.length; i++) {
            const v = padded[i]!;
            if (!Number.isFinite(v)) {
              drawing = false;
              continue;
            }
            const x = i * xStep;
            const y = yAt(v, h, sMin, sMax);
            if (!drawing) {
              ctx.moveTo(x, y);
              drawing = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        };
        strokeFinite(4.5, "rgba(74, 222, 128, 0.28)");
        strokeFinite(2, "#4ade80");

        const last = view[view.length - 1]!;
        const tipX = (cols - 1) * xStep;
        ctx.beginPath();
        ctx.fillStyle = "#bbf7d0";
        ctx.arc(tipX, yAt(last, h, sMin, sMax), 3.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      strokeTrace(ctx, view, w, h, min, max, live);
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
            En vivo · ← scroll
          </span>
        ) : (
          <span className="text-sm font-semibold text-emerald-500/90">
            Vista fijada
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="block w-full" aria-label={label} />
    </div>
  );
}
