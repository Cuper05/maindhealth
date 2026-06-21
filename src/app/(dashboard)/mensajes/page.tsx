import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getMessageThreadsForStaff } from "@/lib/queries/messages";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function MensajesPage() {
  const session = await requireSession();
  if (!can(session?.role, "messages:view")) redirect("/");

  const threads = await getMessageThreadsForStaff();

  return (
    <div>
      <PageHeader
        title="Mensajes clínicos"
        description="Conversaciones con pacientes desde el portal."
      />
      <div className="space-y-3">
        {threads.length === 0 ? (
          <p className="text-sm text-slate-500">Sin conversaciones activas.</p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.patientId}
              href={`/mensajes/${thread.patientId}`}
              className={`block ${cardClassName} hover:border-teal-200`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {thread.chartNumber} — {thread.patientName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Último mensaje{" "}
                    {thread.lastMessageAt.toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {thread.unreadCount > 0 && (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {thread.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
