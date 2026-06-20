import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_MODULE_LABELS,
  activityLogTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string }>;
}) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "config:view")) redirect("/");

  const { modulo } = await searchParams;

  const baseQuery = db
    .select({
      id: activityLogTable.id,
      module: activityLogTable.module,
      action: activityLogTable.action,
      recordId: activityLogTable.recordId,
      detail: activityLogTable.detail,
      createdAt: activityLogTable.createdAt,
      userFirstName: usersTable.firstName,
      userLastNamePaternal: usersTable.lastNamePaternal,
      userLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(activityLogTable)
    .leftJoin(usersTable, eq(activityLogTable.userId, usersTable.id))
    .$dynamic();

  const rows = await (modulo
    ? baseQuery
        .where(eq(activityLogTable.module, modulo))
        .orderBy(desc(activityLogTable.createdAt))
        .limit(200)
    : baseQuery.orderBy(desc(activityLogTable.createdAt)).limit(200));

  const modules = Object.entries(ACTIVITY_MODULE_LABELS);

  return (
    <div>
      <PageHeader
        title="Bitácora del sistema"
        description="Trazabilidad de acciones: quién hizo qué y cuándo."
        backHref="/configuracion"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink href="/bitacora" label="Todos" active={!modulo} />
        {modules.map(([key, label]) => (
          <FilterLink
            key={key}
            href={`/bitacora?modulo=${key}`}
            label={label}
            active={modulo === key}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha / hora</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Módulo</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Registro</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Sin registros en la bitácora.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.createdAt.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3">
                    {row.userFirstName
                      ? formatPersonName({
                          firstName: row.userFirstName,
                          lastNamePaternal: row.userLastNamePaternal!,
                          lastNameMaternal: row.userLastNameMaternal,
                        })
                      : "Sistema"}
                  </td>
                  <td className="px-4 py-3">
                    {ACTIVITY_MODULE_LABELS[row.module as keyof typeof ACTIVITY_MODULE_LABELS] ??
                      row.module}
                  </td>
                  <td className="px-4 py-3">
                    {ACTIVITY_ACTION_LABELS[row.action] ?? row.action}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.recordId ?? "—"}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                    {row.detail ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        active
          ? "bg-teal-50 font-medium text-teal-800"
          : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
