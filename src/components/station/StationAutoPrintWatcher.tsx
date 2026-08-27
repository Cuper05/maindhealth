"use client";

import { useEffect, useRef, useState } from "react";
import { printStationPdf } from "@/lib/kiosk/station-print";

type Props = {
  /** Cita de estación: el watcher consulta /api/station/video-opened?appointmentId= */
  appointmentId: number;
  /** kiosk = cookie de estación; staff = sesión dashboard (Dell). */
  mode: "kiosk" | "staff";
};

/**
 * Cuando el médico firma una receta, la sesión de kiosk marca printPending.
 * Este componente (en kiosk o Dell) descarga el PDF e imprime vía 127.0.0.1:3929.
 */
export function StationAutoPrintWatcher({ appointmentId, mode }: Props) {
  const printingRef = useRef(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) return;

    let cancelled = false;

    async function ackPrint(prescriptionId: number, ok: boolean, error?: string) {
      try {
        await fetch("/api/station/print-ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ appointmentId, prescriptionId, ok, error }),
        });
      } catch {
        /* ignore */
      }
    }

    async function tryPrint() {
      if (cancelled || printingRef.current) return;
      try {
        const res = await fetch(
          `/api/station/video-opened?appointmentId=${appointmentId}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          found?: boolean;
          printPending?: boolean;
          prescriptionId?: number | null;
        };
        if (!data.found || !data.printPending || !data.prescriptionId) return;

        printingRef.current = true;
        const prescriptionId = data.prescriptionId;
        setStatus("Imprimiendo receta firmada…");

        const pdfUrl =
          mode === "kiosk"
            ? `/api/station/prescription/${prescriptionId}/pdf`
            : `/api/prescriptions/${prescriptionId}/pdf`;

        const pdfRes = await fetch(pdfUrl, { credentials: "same-origin" });
        const contentType = pdfRes.headers.get("content-type") ?? "";
        if (!pdfRes.ok || !contentType.includes("application/pdf")) {
          const errBody = (await pdfRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error ?? `No se pudo obtener el PDF (${pdfRes.status})`);
        }
        const bytes = await pdfRes.arrayBuffer();
        if (bytes.byteLength < 100) throw new Error("PDF de receta vacío");

        await printStationPdf(bytes, (msg) => {
          if (!cancelled) setStatus(msg);
        });
        await ackPrint(prescriptionId, true);
        if (!cancelled) setStatus("Receta impresa en estación");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al imprimir";
        if (!cancelled) setStatus(msg);
        const pid = Number(
          (err as { prescriptionId?: number })?.prescriptionId,
        );
        // best-effort ack with last known id from status — refetch
        try {
          const res = await fetch(
            `/api/station/video-opened?appointmentId=${appointmentId}`,
            { cache: "no-store", credentials: "same-origin" },
          );
          const data = (await res.json()) as { prescriptionId?: number | null };
          if (data.prescriptionId) await ackPrint(data.prescriptionId, false, msg);
        } catch {
          if (Number.isFinite(pid) && pid > 0) await ackPrint(pid, false, msg);
        }
      } finally {
        printingRef.current = false;
      }
    }

    void tryPrint();
    const timer = setInterval(() => void tryPrint(), 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appointmentId, mode]);

  if (!status) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2 text-center text-sm text-white shadow-lg">
      {status}
    </div>
  );
}
