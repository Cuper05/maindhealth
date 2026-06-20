import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { consultationsTable } from "@/lib/db/schema";
import {
  getActivePatients,
  getDocumentTypes,
} from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { UploadDocumentForm } from "@/components/forms/UploadDocumentForm";

export default async function NuevoDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    consultationId?: string;
    redirect?: string;
  }>;
}) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "patients:write")) {
    redirect("/documentos");
  }

  const params = await searchParams;
  const [patients, documentTypes, consultations] = await Promise.all([
    getActivePatients(),
    getDocumentTypes(),
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

  return (
    <div>
      <PageHeader
        title="Cargar documento clínico"
        description="PDFs, laboratorios, imágenes y reportes del expediente."
        backHref="/documentos"
      />
      <UploadDocumentForm
        patients={patients}
        documentTypes={documentTypes}
        consultations={consultations}
        defaultPatientId={params.patientId ? Number(params.patientId) : undefined}
        defaultConsultationId={
          params.consultationId ? Number(params.consultationId) : undefined
        }
        redirectTo={params.redirect}
      />
    </div>
  );
}
