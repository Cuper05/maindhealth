import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewPatientForm } from "@/components/forms/NewPatientForm";

export default async function NuevoPacientePage() {
  const session = await requireSession();
  if (!can(session?.role, "patients:write")) redirect("/pacientes");

  return (
    <div>
      <PageHeader
        title="Alta de paciente"
        description="Registra un nuevo paciente y su expediente clínico inicial."
        backHref="/pacientes"
      />
      <NewPatientForm />
    </div>
  );
}
