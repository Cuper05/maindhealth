import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getDeviceTypes } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewDeviceForm } from "@/components/forms/NewDeviceForm";

export default async function NuevoDispositivoPage() {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "config:view")) redirect("/dispositivos");

  const deviceTypes = await getDeviceTypes();

  return (
    <div>
      <PageHeader title="Alta de equipo" description="Registra un dispositivo del teleconsultorio." backHref="/dispositivos" />
      <NewDeviceForm deviceTypes={deviceTypes} />
    </div>
  );
}
