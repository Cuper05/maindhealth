"use client";

import { useEffect, useState } from "react";
import { printStationPdf } from "@/lib/kiosk/station-print";
import {
  KioskPrimaryButton,
  KioskSecondaryButton,
  kioskBodyClassName,
  kioskHelperClassName,
  kioskTitleClassName,
} from "./KioskTheme";

/**
 * Al emitir receta: se envía al correo; el paciente elige si también quiere impresión.
 * SI o NO terminan la sesión y vuelven al inicio del kiosco.
 */
export function DownloadPrescriptionButton({
  prescriptionId,
  folio,
  email,
  onDone,
}: {
  prescriptionId: number;
  folio?: string | null;
  email?: string | null;
  onDone?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<"sending" | "sent" | "failed">("sending");
  const [sentTo, setSentTo] = useState<string | null>(email?.trim() || null);

  useEffect(() => {
    let cancelled = false;
    async function sendEmail() {
      setEmailStatus("sending");
      setError(null);
      try {
        const res = await fetch(`/api/station/prescription/${prescriptionId}/email`, {
          method: "POST",
          credentials: "same-origin",
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          email?: string;
          alreadySent?: boolean;
          skipped?: boolean;
        } | null;
        if (cancelled) return;
        if (!res.ok) {
          setEmailStatus("failed");
          setError(data?.error ?? "No se pudo enviar la receta por correo");
          return;
        }
        setSentTo(data?.email ?? email ?? null);
        setEmailStatus("sent");
      } catch (e) {
        if (!cancelled) {
          setEmailStatus("failed");
          setError(e instanceof Error ? e.message : "No se pudo enviar la receta por correo");
        }
      }
    }
    void sendEmail();
    return () => {
      cancelled = true;
    };
  }, [prescriptionId, email]);

  async function goHome() {
    try {
      await onDone?.();
    } catch (e) {
      console.warn("[prescription] onDone failed", e);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("nueva", "1");
        window.location.replace(url.toString());
      } catch {
        window.location.assign("/estacion/paciente?nueva=1");
      }
    }
  }

  async function finish(printCopy: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (printCopy) {
        const res = await fetch(`/api/station/prescription/${prescriptionId}/pdf`, {
          credentials: "same-origin",
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !contentType.includes("application/pdf")) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `Error al generar la receta (${res.status})`);
        }
        const pdfBytes = await res.arrayBuffer();
        if (pdfBytes.byteLength < 100) {
          throw new Error("El PDF generado está vacío.");
        }
        try {
          await printStationPdf(pdfBytes);
        } catch (printErr) {
          console.warn("[prescription] print failed", printErr);
          setError(
            printErr instanceof Error
              ? printErr.message
              : "No se pudo imprimir. Igual finalizamos la sesión.",
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error con la receta");
    }

    window.setTimeout(() => {
      void goHome();
    }, printCopy ? 900 : 400);
  }

  const displayEmail = sentTo || email || "su correo registrado";

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">
      {folio ? (
        <p className={`shrink-0 text-center ${kioskHelperClassName}`}>
          Folio <strong className="text-slate-800">{folio}</strong>
        </p>
      ) : null}

      <div className="rounded-2xl border-2 border-[#1d6eb8]/35 bg-[#f0f7ff] px-5 py-6 text-center">
        <p className={`${kioskTitleClassName} text-[#0b4f8a]`}>Su receta por correo</p>
        <p className={`mt-4 ${kioskBodyClassName}`}>
          La receta <strong>será enviada a su correo electrónico</strong>:
        </p>
        <p className="mt-3 break-all text-2xl font-bold text-slate-900 xl:text-3xl">{displayEmail}</p>
        <p className={`mt-4 ${kioskHelperClassName}`}>
          {emailStatus === "sending"
            ? "Enviando receta…"
            : emailStatus === "sent"
              ? "Correo enviado. Revise su bandeja de entrada (y spam)."
              : "No se pudo confirmar el envío. El personal puede reenviar la receta."}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-6 text-center">
        <p className={`font-bold text-slate-900 ${kioskBodyClassName}`}>
          ¿Desea también una copia impresa de su receta?
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <KioskPrimaryButton
            className="w-full !min-h-[80px] !text-3xl"
            disabled={busy}
            onClick={() => void finish(true)}
          >
            {busy ? "…" : "SÍ"}
          </KioskPrimaryButton>
          <KioskSecondaryButton
            className="w-full !min-h-[80px] !text-3xl !font-bold"
            disabled={busy}
            onClick={() => void finish(false)}
          >
            {busy ? "…" : "NO"}
          </KioskSecondaryButton>
        </div>
        <p className={`mt-4 ${kioskHelperClassName}`}>
          Cualquier opción termina la atención y regresa a la pantalla inicial.
        </p>
      </div>

      {error ? (
        <p role="alert" className={`text-center font-medium text-rose-700 ${kioskHelperClassName}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
