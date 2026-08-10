import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { StationStandbyScreen } from "@/components/station/StationStandbyScreen";

/**
 * Pantalla corporativa siempre encendida en la Dell.
 * AutoPilot abre /estacion/sala/[id] cuando hay teleconsulta.
 * Herramientas de staff: /estacion/panel
 */
export default async function EstacionStandbyPage() {
  const session = await requireSession();
  if (!can(session?.role, "intake:view")) redirect("/");

  return <StationStandbyScreen />;
}
