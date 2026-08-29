"use client";

import { useState } from "react";

/**
 * Sale de la sala y cierra la espera en DB para que el autopilot no la reabra.
 */
export function StationCancelSalaButton({
  appointmentId,
}: {
  appointmentId: number;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            await fetch("/api/station/waiting", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "dismiss", appointmentId }),
            });
          } catch {
            /* ignore — igual volvemos a standby */
          }
          window.location.assign("/estacion");
        })();
      }}
    >
      {busy ? "Saliendo…" : "Cancelar / standby"}
    </button>
  );
}
