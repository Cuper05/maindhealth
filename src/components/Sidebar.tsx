"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { ROLE_LABELS, canAccessRoute } from "@/lib/auth/permissions";

const NAV = [
  { href: "/", label: "Dashboard", phase: 1 },
  { href: "/pacientes", label: "Pacientes", phase: 1 },
  { href: "/agenda", label: "Agenda", phase: 1 },
  { href: "/triage", label: "Triage / signos vitales", phase: 1 },
  { href: "/consultas", label: "Consultas", phase: 1 },
  { href: "/recetas", label: "Recetas", phase: 1 },
  { href: "/seguimientos", label: "Seguimientos", phase: 1 },
  { href: "/documentos", label: "Documentos clínicos", phase: 2 },
  { href: "/dispositivos", label: "Dispositivos médicos", phase: 2 },
  { href: "/reportes", label: "Reportes", phase: 2 },
  { href: "/configuracion", label: "Configuración", phase: 2 },
] as const;

export function Sidebar({
  userName,
  role,
}: {
  userName: string;
  role: UserRole;
}) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const visibleNav = NAV.filter((item) => canAccessRoute(role, item.href));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
          {APP_NAME}
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-900">
          {userName}
        </p>
        <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                active
                  ? "bg-teal-50 font-medium text-teal-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
              {item.phase === 2 && (
                <span className="ml-1 text-[10px] uppercase text-slate-400">
                  f2
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
