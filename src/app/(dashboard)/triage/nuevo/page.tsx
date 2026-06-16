import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  patientsTable,
} from "@/lib/db/schema";
import {
  getActivePatients,
} from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { VitalSignsForm } from "@/components/forms/VitalSignsForm";

export default async function NuevoTriagePage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    appointmentId?: string;
    redirect?: string;
  }>;
}) {
  const session = await requireSession();
  if (!can(session?.role, "vitals:write")) redirect("/triage");

  const params = await searchParams;
  const [patients, appointments] = await Promise.all([
    getActivePatients(),
    db
      .select({
        id: appointmentsTable.id,
        startAt: appointmentsTable.startAt,
        patientFirstName: patientsTable.firstName,
        patientLastNamePaternal: patientsTable.lastNamePaternal,
        patientLastNameMaternal: patientsTable.lastNameMaternal,
      })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .orderBy(desc(appointmentsTable.startAt))
      .limit(50),
  ]);

  return (
    <div>
      <PageHeader
        title="Captura de signos vitales"
        description="Triage del teleconsultorio — baumanómetro, oxímetro, termómetro, báscula, glucómetro."
        backHref="/triage"
      />
      <VitalSignsForm
        patients={patients}
        appointments={appointments}
        defaultPatientId={params.patientId ? Number(params.patientId) : undefined}
        defaultAppointmentId={
          params.appointmentId ? Number(params.appointmentId) : undefined
        }
        redirectTo={params.redirect ?? "/triage"}
      />
    </div>
  );
}
