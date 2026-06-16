import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  getActiveDoctors,
  getActivePatients,
  getAppointmentTypes,
} from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewAppointmentForm } from "@/components/forms/NewAppointmentForm";

export default async function NuevaCitaPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session?.role, "appointments:write")) redirect("/agenda");

  const { patientId } = await searchParams;
  const [patients, doctors, types] = await Promise.all([
    getActivePatients(),
    getActiveDoctors(),
    getAppointmentTypes(),
  ]);

  return (
    <div>
      <PageHeader
        title="Nueva cita"
        description="Programa una teleconsulta o cita presencial."
        backHref="/agenda"
      />
      <NewAppointmentForm
        patients={patients}
        doctors={doctors}
        types={types}
        defaultPatientId={patientId ? Number(patientId) : undefined}
      />
    </div>
  );
}
