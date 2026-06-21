import { redirect } from "next/navigation";
import { LabResultForm } from "@/components/forms/LabResultForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getActivePatients } from "@/lib/queries/catalogs";
import { formatPersonName } from "@/lib/format/name";

export default async function NuevoLabResultPage() {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "labs:write")) redirect("/laboratorio");

  const patients = await getActivePatients();

  return (
    <div>
      <PageHeader title="Nuevo resultado de laboratorio" backHref="/laboratorio" />
      <LabResultForm
        patients={patients.map((p) => ({
          id: p.id,
          label: `${p.chartNumber} — ${formatPersonName(p)}`,
        }))}
      />
    </div>
  );
}
