"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Tras abrir desde SMS (/t) o app: enfoca video (paciente grande), signos o receta.
 */
export function FocusRecetaOnLoad() {
  const params = useSearchParams();
  useEffect(() => {
    const focus = params.get("focus");
    if (
      focus !== "receta" &&
      focus !== "datos" &&
      focus !== "kiosk" &&
      focus !== "video"
    ) {
      return;
    }
    const t = window.setTimeout(() => {
      const target =
        focus === "receta"
          ? (document.getElementById("prescription-form") ??
            document.getElementById("receta"))
          : focus === "video"
            ? document.getElementById("video")
            : (document.getElementById("kiosk-datos") ??
              document.getElementById("video"));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(t);
  }, [params]);
  return null;
}
