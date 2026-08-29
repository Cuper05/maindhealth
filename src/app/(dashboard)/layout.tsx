import { Sidebar } from "@/components/Sidebar";
import { StationTeleconsultaAutoPilot } from "@/components/station/StationTeleconsultaAutoPilot";
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
  if (session.role === "patient") {
    redirect("/portal");
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

  // AutoPilot global: solo navega si esta PC activó "modo estación" (visitar /estacion).
  // Así Agenda u otras rutas en la Dell aún abren la sala; laptops remotas no se secuestran.
  const stationWatch = can(session.role, "intake:view");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userName={session.name}
        role={session.role}
        unreadNotifications={unreadNotifications}
      />
      {/* Sala / teleconsulta médico: sin padding que robe espacio al video en móvil. */}
      <main className="relative min-w-0 flex-1 overflow-auto p-4 md:p-8 [&:has([data-station-sala])]:p-0 [&:has([data-station-standby])]:p-0 [&:has([data-teleconsulta-doctor])]:p-0">
        {stationWatch ? <StationTeleconsultaAutoPilot /> : null}
        {children}
      </main>
    </div>
  );
}
