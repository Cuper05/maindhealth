import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { consultationsTable } from "@/lib/db/schema";
import {
  getActiveDoctors,
  getActivePatients,
} from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { FollowUpForm } from "@/components/forms/FollowUpForm";

export default async function NuevoSeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    consultationId?: string;
    doctorId?: string;
    redirect?: string;
  }>;
}) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "followups:write")) redirect("/seguimientos");

  const params = await searchParams;
  const [patients, doctors, consultations] = await Promise.all([
    getActivePatients(),
    getActiveDoctors(),
    db
      .select({
        id: consultationsTable.id,
        diagnosis: consultationsTable.diagnosis,
        consultedAt: consultationsTable.consultedAt,
        patientId: consultationsTable.patientId,
      })
      .from(consultationsTable)
      .orderBy(desc(consultationsTable.consultedAt))
      .limit(100),
  ]);

  const defaultDoctorId =
    session.role === "doctor"
      ? session.userId
      : params.doctorId
        ? Number(params.doctorId)
        : undefined;

  return (
    <div>
      <PageHeader
        title="Nuevo seguimiento"
        description="Registra la evolución del paciente y programa la próxima revisión."
        backHref="/seguimientos"
      />
      <FollowUpForm
        patients={patients}
        doctors={doctors}
        consultations={consultations}
        defaultPatientId={params.patientId ? Number(params.patientId) : undefined}
        defaultConsultationId={
          params.consultationId ? Number(params.consultationId) : undefined
        }
        defaultDoctorId={defaultDoctorId}
        redirectTo={params.redirect}
      />
    </div>
  );
}
