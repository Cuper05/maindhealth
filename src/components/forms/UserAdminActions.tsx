"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deactivateUser,
  deleteUserPermanent,
  reactivateUser,
} from "@/lib/actions/users";

export function UserAdminActions({
  userId,
  displayName,
  active,
  isAdmin,
}: {
  userId: number;
  displayName: string;
  active: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "No se pudo completar la acción");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs text-slate-500">
        Desactivar quita el acceso y lo oculta de agendas/teleconsulta. Borrar solo funciona si no
        tiene historial clínico.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {active ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`¿Desactivar a ${displayName}?`)) return;
              run(() => deactivateUser(userId));
            }}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            {pending ? "…" : "Desactivar"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reactivateUser(userId))}
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-60"
          >
            {pending ? "…" : "Reactivar"}
          </button>
        )}
        {isAdmin ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const ok = window.confirm(
                `BORRADO DEFINITIVO de ${displayName}.\n\nSolo si no tiene citas, consultas ni recetas.\n\n¿Continuar?`,
              );
              if (!ok) return;
              run(() => deleteUserPermanent(userId));
            }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
          >
            {pending ? "…" : "Borrar definitivo"}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
