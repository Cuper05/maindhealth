import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

/**
 * Pantalla corporativa en espera para la PC Dell de estación.
 * El auto-join (StationTeleconsultaAutoPilot) navega a /estacion/sala/[id].
 */
export function StationStandbyScreen() {
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

      <div className="relative z-10 flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="station-standby-enter flex flex-col items-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/12 text-2xl font-bold tracking-tight shadow-[0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm md:h-24 md:w-24 md:text-3xl">
            MH
          </div>

          <p className="text-sm font-medium uppercase tracking-[0.35em] text-blue-100/90 md:text-base">
            {APP_NAME}
          </p>

          <h1 className="mt-5 max-w-2xl font-sans text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Estación lista
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-100/90 md:text-xl">
            La videoconsulta se abrirá automáticamente
          </p>

          <div className="mt-10 flex items-center gap-3 rounded-full border border-white/15 bg-white/8 px-5 py-2.5 text-sm text-blue-50/95 backdrop-blur-sm">
            <span
              aria-hidden
              className="station-standby-pulse inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"
            />
            <span>En espera · Conectado</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center pb-6">
        <Link
          href="/estacion/panel"
          className="text-xs text-white/35 underline-offset-4 transition hover:text-white/70 hover:underline"
        >
          Panel de personal
        </Link>
      </div>
    </div>
  );
}
