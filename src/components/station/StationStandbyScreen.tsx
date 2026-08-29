"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { MaindOsLogo } from "@/components/MaindOsLogo";

/**
 * Pantalla corporativa siempre encendida en la Dell.
 * Sin menú del sistema completo. Personal puede abrir MaindHealth desde aquí.
 */
export function StationStandbyScreen() {
  const router = useRouter();
  const pressTimer = useRef<number | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const clearPress = useCallback(() => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
    }
    pressTimer.current = null;
  }, []);

  const startPress = useCallback(() => {
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      setAdminOpen(true);
    }, 2000);
  }, [clearPress]);

  return (
    <div
      data-station-standby
      className="fixed inset-0 z-40 flex flex-col overflow-hidden text-white"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-[#0c2a47] via-[#143d66] to-[#1d6eb8]"
      />
      <div
        aria-hidden
        className="station-standby-glow absolute -left-1/4 top-[-20%] h-[70%] w-[70%] rounded-full bg-[#4ea1e8]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="station-standby-glow-delayed absolute -right-1/4 bottom-[-10%] h-[55%] w-[55%] rounded-full bg-[#1a4d7c]/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-8 pb-6 pt-16 text-center">
        <div className="station-standby-enter flex flex-col items-center">
          <button
            type="button"
            className="rounded-3xl bg-white px-8 py-6 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Logo MaindHealth. Mantenga pulsado para opciones de personal."
            onPointerDown={startPress}
            onPointerUp={clearPress}
            onPointerLeave={clearPress}
            onPointerCancel={clearPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <BrandLogo width={340} priority size="full" />
          </button>

          <h1 className="mt-10 max-w-4xl font-sans text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Estación lista
          </h1>

          <p className="mt-6 max-w-3xl text-2xl leading-relaxed text-blue-100/90 md:text-3xl">
            La videoconsulta se abrirá automáticamente
          </p>

          <div className="mt-12 flex items-center gap-4 rounded-full border border-white/15 bg-white/8 px-7 py-3.5 text-xl text-blue-50/95 backdrop-blur-sm md:text-2xl">
            <span
              aria-hidden
              className="station-standby-pulse inline-block h-3.5 w-3.5 rounded-full bg-emerald-400"
            />
            <span>En espera · Conectado</span>
          </div>

          <div className="mt-8">
            <MaindOsLogo width={320} priority />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-3 px-6 pb-8">
        <button
          type="button"
          className="min-h-[52px] rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-lg font-semibold text-white backdrop-blur hover:bg-white/20"
          onClick={() => setAdminOpen(true)}
        >
          Abrir sistema MaindHealth
        </button>
        <button
          type="button"
          className="min-h-[52px] rounded-xl border border-white/20 bg-transparent px-6 py-3 text-lg font-medium text-blue-100/90 hover:bg-white/10"
          onClick={() => router.push("/estacion/panel")}
        >
          Panel de estación
        </button>
      </div>

      {adminOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
            <p className="text-lg font-bold">Acceso de personal</p>
            <p className="mt-2 text-sm text-slate-600">
              Abrir el sistema MaindHealth para configuración, pacientes o panel.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl bg-[#1d6eb8] px-4 py-3 text-base font-semibold text-white hover:bg-[#185a96]"
                onClick={() => router.push("/")}
              >
                Abrir sistema MaindHealth
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-3 text-base font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => router.push("/estacion/panel")}
              >
                Panel de estación
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-3 text-base font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => router.push("/pagos")}
              >
                Ver pagos
              </button>
              <button
                type="button"
                className="mt-1 text-sm text-slate-500 underline"
                onClick={() => setAdminOpen(false)}
              >
                Cancelar / seguir en espera
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
