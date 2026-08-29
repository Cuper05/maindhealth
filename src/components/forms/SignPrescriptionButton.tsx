"use client";

import { useState, useTransition } from "react";
import { signPrescription } from "@/lib/actions/digital-signatures";

export function SignPrescriptionButton({
  prescriptionId,
  signed,
  signatureHash,
}: {
  prescriptionId: number;
  signed: boolean;
  signatureHash?: string | null;
}) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSign() {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await signPrescription(prescriptionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const queued = "printQueued" in result && Boolean(result.printQueued);
      setSuccess(
        queued
          ? "Receta firmada. Se envió a imprimir en la estación."
          : "Receta firmada digitalmente",
      );
    });
  }

  if (signed) {
    return (
      <p className="text-sm text-teal-800">
        Firmada digitalmente
        {signatureHash ? (
          <span className="mt-1 block font-mono text-xs text-slate-500">
            {signatureHash.slice(0, 16)}…
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSign}
        disabled={pending}
        className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-60"
      >
        {pending ? "Firmando…" : "Firmar receta digitalmente"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-teal-700">{success}</p>}
    </div>
  );
}
