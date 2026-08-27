"use client";

import { useCallback, useEffect, useState } from "react";
import type { KioskStep } from "@/lib/db/schema/station-kiosk";
import {
  isKioskVoiceMuted,
  setKioskVoiceMuted,
  speakKioskStep,
  stopKioskVoice,
} from "@/lib/kiosk/voice-guide";

/**
 * Guía hablada del kiosko: habla al cambiar de paso; respeta silencio del usuario.
 */
export function useKioskVoice(step: KioskStep, enabled = true) {
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMuted(isKioskVoiceMuted());
    setReady(true);
    // Precargar voces en Edge/Chrome.
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    return () => stopKioskVoice();
  }, []);

  useEffect(() => {
    if (!ready || !enabled || muted) return;
    // Más margen tras cancelar el paso anterior (Edge).
    const t = window.setTimeout(() => speakKioskStep(step), 500);
    return () => {
      window.clearTimeout(t);
      stopKioskVoice();
    };
  }, [step, muted, ready, enabled]);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setKioskVoiceMuted(next);
      if (next) stopKioskVoice();
      else speakKioskStep(step, { force: true });
      return next;
    });
  }, [step]);

  return { muted, toggleMuted, ready };
}
