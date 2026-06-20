import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { syncUserNotifications } from "@/lib/notifications/sync";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (!session?.userId || !session.role || !session.name) {
    redirect("/login");
  }

  let unreadNotifications = 0;
  if (can(session.role, "notifications:view")) {
    try {
      await syncUserNotifications(session.userId, session.role);
      unreadNotifications = await getUnreadNotificationCount(session.userId);
    } catch (err) {
      console.error("[notifications]", err);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userName={session.name}
        role={session.role}
        unreadNotifications={unreadNotifications}
      />
      <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
