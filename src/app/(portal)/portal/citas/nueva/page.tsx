import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getActiveDoctors } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalAppointmentForm } from "@/components/forms/PortalAppointmentForm";

export default async function PortalNuevaCitaPage() {
  const session = await requireSession();
  if (!can(session?.role, "appointments:book")) redirect("/portal/citas");

  const doctors = await getActiveDoctors();

  return (
    <div>
      <PageHeader
        title="Agendar cita"
        description="Solicita una nueva consulta desde el portal."
        backHref="/portal/citas"
      />
      {doctors.length === 0 ? (
        <p className="text-sm text-slate-500">No hay médicos disponibles en este momento.</p>
      ) : (
        <PortalAppointmentForm doctors={doctors} />
      )}
    </div>
  );
}
