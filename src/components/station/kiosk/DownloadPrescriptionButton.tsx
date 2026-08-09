"use client";

import { useState } from "react";

export function DownloadPrescriptionButton({
  prescriptionId,
  folio,
}: {
  prescriptionId: number;
  folio?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/station/prescription/${prescriptionId}/pdf`, {
        credentials: "same-origin",
      });
      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok || !contentType.includes("application/pdf")) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          data?.error ??
            (res.ok
              ? "La respuesta del servidor no es un PDF válido"
              : `Error al descargar (${res.status})`),
        );
      }

      const blob = await res.blob();
      if (blob.size < 100) {
        throw new Error("El PDF generado está vacío. Intenta de nuevo.");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = folio ? `${folio}.pdf` : `receta-${prescriptionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar la receta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Generando PDF…" : "Descargar receta PDF"}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
