import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rolesTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default async function ConfiguracionPage() {
  const session = await requireSession();
  const canManage = can(session?.role, "config:view");

  if (!canManage) {
    return (
      <ModulePlaceholder
        title="Configuración"
        description="Catálogos, usuarios y roles del sistema."
        phase={2}
      />
    );
  }

  const users = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastNamePaternal: usersTable.lastNamePaternal,
      lastNameMaternal: usersTable.lastNameMaternal,
      email: usersTable.email,
      specialty: usersTable.specialty,
      professionalLicense: usersTable.professionalLicense,
      active: usersTable.active,
      roleName: rolesTable.name,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .orderBy(asc(usersTable.lastNamePaternal), asc(usersTable.firstName));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
      <p className="mt-1 text-slate-600">
        Usuarios internos, roles y catálogos del sistema.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/bitacora"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Ver bitácora del sistema →
        </Link>
        <Link
          href="/configuracion/catalogos"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Catálogos clínicos →
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-slate-800">Usuarios</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Especialidad</th>
                <th className="px-4 py-3 font-medium">Cédula</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{formatPersonName(u)}</td>
                  <td className="px-4 py-3">{u.roleName}</td>
                  <td className="px-4 py-3">{u.specialty ?? "—"}</td>
                  <td className="px-4 py-3">{u.professionalLicense ?? "—"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.active ? "Activo" : "Inactivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        Catálogos de síntomas, diagnósticos y medicamentos disponibles en{" "}
        <Link href="/configuracion/catalogos" className="text-teal-700 hover:underline">
          Catálogos clínicos
        </Link>
        .
      </section>
    </div>
  );
}
