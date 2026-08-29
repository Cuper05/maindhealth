"use client";

import { useEffect, useRef } from "react";

/**
 * Si el médico cuelga / guarda la consulta y marca call_ended en DB,
 * la Dell vuelve a standby aunque Daily no dispare participant-left.
 */
export function StationSalaCallEndWatcher({
  appointmentId,
}: {
  appointmentId: number;
}) {
  const leavingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || leavingRef.current) return;
      try {
        const res = await fetch(
          `/api/station/video-opened?appointmentId=${appointmentId}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { callEnded?: boolean };
        if (data.callEnded === true && !leavingRef.current) {
          leavingRef.current = true;
          window.location.assign("/estacion");
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appointmentId]);

  return null;
}
