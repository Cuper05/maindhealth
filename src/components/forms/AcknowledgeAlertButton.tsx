"use client";

import { useTransition } from "react";
import { acknowledgeClinicalAlert } from "@/lib/actions/clinical-alerts";

export function AcknowledgeAlertButton({ alertId }: { alertId: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await acknowledgeClinicalAlert(alertId);
        });
      }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "Marcando…" : "Atender"}
    </button>
  );
}
