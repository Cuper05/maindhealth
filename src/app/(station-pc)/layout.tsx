import { redirect } from "next/navigation";
import { StationTeleconsultaAutoPilot } from "@/components/station/StationTeleconsultaAutoPilot";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

/**
 * PC Dell de estación: solo pantalla de espera / teleconsulta.
 * Sin menú lateral del sistema. El admin sale con gesto en el logo.
 */
export default async function StationPcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (!session?.userId || !session.role) {
    redirect("/login?from=/estacion");
  }
  if (session.role === "patient") {
    redirect("/portal");
  }
  if (!can(session.role, "intake:view")) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#0c2a47] antialiased">
      {/* Siempre vigilando teleconsultas entrantes en esta PC dedicada. */}
      <StationTeleconsultaAutoPilot forceEnabled dedicatedUi />
      {children}
    </div>
  );
}
