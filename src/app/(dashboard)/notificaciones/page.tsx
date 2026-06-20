import { redirect } from "next/navigation";
import {
  MarkAllReadButton,
  MarkReadButton,
  NotificationLink,
} from "@/components/notifications/NotificationActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  NOTIFICATION_TYPE_LABELS,
  type NotificationType,
} from "@/lib/db/schema/notifications";
import { syncUserNotifications } from "@/lib/notifications/sync";
import { getUserNotifications } from "@/lib/queries/notifications";

export default async function NotificacionesPage() {
  const session = await requireSession();
  if (!session?.userId || !session.role || !can(session.role, "notifications:view")) {
    redirect("/");
  }

  await syncUserNotifications(session.userId, session.role);
  const rows = await getUserNotifications(session.userId);
  const unread = rows.filter((row) => !row.readAt).length;

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        description="Recordatorios de citas, seguimientos, triage y alertas operativas."
        action={unread > 0 ? <MarkAllReadButton /> : undefined}
      />

      {unread > 0 && (
        <p className="mb-4 text-sm text-slate-600">
          Tienes <span className="font-medium text-teal-800">{unread}</span> sin leer.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Mensaje</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Sin notificaciones por ahora.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const unreadRow = !row.readAt;
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 ${unreadRow ? "bg-teal-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.createdAt.toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3">
                      {NOTIFICATION_TYPE_LABELS[row.type as NotificationType] ?? row.type}
                    </td>
                    <td className="px-4 py-3">
                      <NotificationLink href={row.href}>
                        <span className={`block ${unreadRow ? "font-medium text-slate-900" : "text-slate-700"}`}>
                          {row.title}
                        </span>
                      </NotificationLink>
                      {row.body && (
                        <p className="mt-1 max-w-md truncate text-xs text-slate-500">{row.body}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {unreadRow ? (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                          Nueva
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Leída</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {unreadRow && <MarkReadButton notificationId={row.id} />}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
