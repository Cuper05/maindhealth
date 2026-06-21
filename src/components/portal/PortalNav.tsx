"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/portal", label: "Inicio" },
  { href: "/portal/citas", label: "Mis citas" },
  { href: "/portal/mensajes", label: "Mensajes" },
  { href: "/portal/recetas", label: "Recetas" },
  { href: "/portal/documentos", label: "Documentos" },
  { href: "/portal/laboratorio", label: "Laboratorio" },
  { href: "/portal/pagos", label: "Pagos" },
] as const;

export function PortalNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="border-b border-teal-100 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-600">{APP_NAME}</p>
          <p className="text-sm font-medium text-slate-900">Portal del paciente · {userName}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-slate-600 hover:text-teal-700"
        >
          Cerrar sesión
        </button>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || (href !== "/portal" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                active
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
