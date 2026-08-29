"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archivePatient,
  deletePatientPermanent,
  reactivatePatient,
} from "@/lib/actions/patients";

export function PatientAdminActions({
  patientId,
  chartNumber,
  status,
  isAdmin,
}: {
  patientId: number;
  chartNumber: string;
  status: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const archived = status === "archived";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, redirectList = false) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "No se pudo completar la acción");
        return;
      }
      if (redirectList) {
        router.push("/pacientes");
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Administrar expediente</h3>
      <p className="mt-1 text-xs text-slate-500">
        Archivar oculta al paciente de la lista principal. Borrar elimina todo de forma definitiva
        (citas, recetas, signos).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reactivatePatient(patientId))}
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-60"
          >
            {pending ? "…" : "Reactivar"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`¿Archivar el expediente ${chartNumber}?`)) return;
              run(() => archivePatient(patientId));
            }}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            {pending ? "…" : "Archivar"}
          </button>
        )}
        {isAdmin ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const ok = window.confirm(
                `BORRADO DEFINITIVO de ${chartNumber}.\n\nSe eliminarán citas, consultas, recetas y signos vitales. Esta acción no se puede deshacer.\n\n¿Continuar?`,
              );
              if (!ok) return;
              const typed = window.prompt(`Escriba ${chartNumber} para confirmar el borrado:`);
              if (typed?.trim() !== chartNumber) {
                setError("Confirmación incorrecta. No se borró nada.");
                return;
              }
              run(() => deletePatientPermanent(patientId), true);
            }}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
          >
            {pending ? "…" : "Borrar definitivamente"}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
