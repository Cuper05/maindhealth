"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: { error?: string; user?: { role?: string } } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      const from = searchParams.get("from");
      const role = data.user?.role;
      const defaultPath = role === "patient" ? "/portal" : "/";
      // Hard redirect: preserves /estacion/sala/... after session expiry on the Dell.
      const dest =
        from && from.startsWith("/") && !from.startsWith("//") ? from : defaultPath;
      window.location.assign(dest);
    } catch {
      setError("No se pudo conectar con el servidor");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Correo
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@maindhealth.local"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-700 px-4 py-2 text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}

export function LoginFormWrapper() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
      <LoginForm />
    </Suspense>
  );
}
