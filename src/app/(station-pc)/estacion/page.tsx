import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { StationStandbyScreen } from "@/components/station/StationStandbyScreen";

/**
 * Pantalla única de la Dell: estación lista.
 * La sala de video solo se abre cuando hay teleconsulta.
 */
export default async function EstacionStandbyPage() {
  const session = await requireSession();
  if (!can(session?.role, "intake:view")) redirect("/");

  return <StationStandbyScreen />;
}
