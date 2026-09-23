"use client";

import { useState } from "react";
import { KARDIA_APP_STORE, KARDIA_PLAY_STORE } from "@/lib/kiosk/kardia";

export function KardiaUploadForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Elija el PDF o la foto del ECG.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/station/kardia/${encodeURIComponent(token)}`, {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-2xl bg-emerald-50 px-4 py-4 text-lg font-medium text-emerald-950">
        Listo. El ECG ya está en la visita. Puede volver a la pantalla de la estación y
        tocar Continuar.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-3 text-base">
        <a
          className="rounded-xl bg-[#1d6eb8] px-4 py-3 font-semibold text-white"
          href={KARDIA_PLAY_STORE}
        >
          Descargar Kardia (Android)
        </a>
        <a
          className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
          href={KARDIA_APP_STORE}
        >
          Descargar Kardia (iPhone)
        </a>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-base text-slate-800">
        <li>Abra la app Kardia y tome el ECG (dedos en las placas, 30 s).</li>
        <li>Historial → tres puntos → Descargar PDF (sin contraseña).</li>
        <li>En esta página, elija ese PDF o una foto de la pantalla y envíelo.</li>
      </ol>
      <input
        name="file"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/*"
        className="block w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-base"
        required
      />
      {error ? <p className="text-base font-medium text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-teal-700 px-4 py-4 text-xl font-bold text-white disabled:opacity-60"
      >
        {busy ? "Enviando…" : "Enviar ECG a la visita"}
      </button>
    </form>
  );
}
