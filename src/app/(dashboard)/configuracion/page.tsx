import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rolesTable, usersTable } from "@/lib/db/schema";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { EditUserProfileForm } from "@/components/forms/EditUserProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ConfiguracionPage() {
  const session = await requireSession();
  const canManage = can(session?.role, "config:view");
  const canEditUsers = can(session?.role, "users:write");
  const isAdmin = session?.role === "admin";

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
      phone: usersTable.phone,
      specialty: usersTable.specialty,
      professionalLicense: usersTable.professionalLicense,
      active: usersTable.active,
      teleconsultaAvailable: usersTable.teleconsultaAvailable,
      roleName: rolesTable.name,
      roleCode: rolesTable.code,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .orderBy(asc(usersTable.lastNamePaternal), asc(usersTable.firstName));

  const doctors = users.filter((u) => u.roleCode === "doctor");
  const otherUsers = users.filter((u) => u.roleCode !== "doctor");

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Usuarios internos, médicos, roles y catálogos del sistema."
      />

      <div className="mb-6 flex flex-wrap gap-3">
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

      <section className="mb-10">
        <h2 className="text-lg font-medium text-slate-800">Médicos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Nombre, cédula, especialidad, teléfono de alertas, disponibilidad y contraseña de acceso.
        </p>
        <div className="mt-4 space-y-4">
          {doctors.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              No hay médicos en el sistema.
            </p>
          ) : canEditUsers ? (
            doctors.map((d) => <EditUserProfileForm key={d.id} user={d} isAdmin={isAdmin} />)
          ) : (
            doctors.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {d.firstName} {d.lastNamePaternal} {d.lastNameMaternal ?? ""}
                </p>
                <p className="text-slate-600">
                  {d.specialty || "Sin especialidad"}
                  {d.professionalLicense ? ` · Cédula ${d.professionalLicense}` : ""}
                </p>
                <p className="text-slate-600">
                  Tel: {d.phone || "—"} · {d.email} · Disponible teleconsulta:{" "}
                  {d.teleconsultaAvailable ? "sí" : "no"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-800">Otros usuarios</h2>
        <p className="mt-1 text-sm text-slate-600">
          Administradores, enfermería, recepción y demás roles.
        </p>
        <div className="mt-4 space-y-4">
          {otherUsers.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Sin otros usuarios.
            </p>
          ) : canEditUsers ? (
            otherUsers.map((u) => (
              <EditUserProfileForm key={u.id} user={u} isAdmin={isAdmin} />
            ))
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Rol</th>
                    <th className="px-4 py-3 font-medium">Correo</th>
                    <th className="px-4 py-3 font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {otherUsers.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">
                        {u.firstName} {u.lastNamePaternal}
                      </td>
                      <td className="px-4 py-3">{u.roleName}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">{u.active ? "Activo" : "Inactivo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
