"use client";

import { useEffect, useRef, useState } from "react";
import { kioskApi } from "./kiosk-api";

export function KardiaStationConnector({
  token,
  received,
  onReceived,
}: {
  token: string;
  received: boolean;
  onReceived: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    const url = `${window.location.origin}/estacion/kardia/${token}`;
    void import("qrcode").then((mod) =>
      mod.default
        .toDataURL(url, { margin: 1, width: 280, errorCorrectionLevel: "M" })
        .then(setQr),
    );
  }, [token]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data = await kioskApi.uploadKardia(file);
      const rhythm = data.vitalsDraft?.ecgRhythm ?? "ECG Kardia recibido";
      onReceived(rhythm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  if (received) {
    return (
      <p className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-lg font-semibold text-emerald-950">
        ECG de Kardia recibido. El médico lo verá en la teleconsulta.
      </p>
    );
  }

  return (
    <div className="shrink-0 rounded-2xl border-2 border-[#1d6eb8]/30 bg-white p-3">
      <p className="text-center text-lg font-bold text-[#0b4f8a]">
        KardiaMobile: escanee con el celular
      </p>
      <p className="mt-1 text-center text-base text-slate-700">
        Baje la app Kardia, tome el ECG, descargue el PDF y súbalo en el celular. El
        kiosko se actualiza solo.
      </p>
      {qr ? (
        <img
          src={qr}
          alt="Código para enviar el ECG de Kardia"
          className="mx-auto mt-2 h-40 w-40 bg-white"
        />
      ) : (
        <p className="mt-2 text-center text-sm text-slate-500">Generando código…</p>
      )}
      <div className="mt-2 text-center">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border-2 border-slate-300 px-4 py-2 text-base font-semibold text-slate-800 disabled:opacity-60"
        >
          {busy ? "Cargando…" : "O cargar el PDF en esta pantalla"}
        </button>
      </div>
      {error ? <p className="mt-2 text-center text-base text-red-700">{error}</p> : null}
    </div>
  );
}
