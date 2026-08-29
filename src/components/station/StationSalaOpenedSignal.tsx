"use client";

import { useEffect } from "react";

/** Marca que la sala de video abrió (no silencia la voz de calma del kiosko). */
export function StationSalaOpenedSignal({ appointmentId }: { appointmentId: number }) {
  useEffect(() => {
    void fetch("/api/station/video-opened", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, event: "sala_opened" }),
    }).catch(() => {
      /* ignore */
    });
  }, [appointmentId]);

  return null;
}
