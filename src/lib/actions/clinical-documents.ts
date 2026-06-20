"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { clinicalDocumentsTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import {
  saveClinicalDocumentFile,
  validateClinicalDocumentFile,
} from "@/lib/storage/clinical-documents";

export async function uploadClinicalDocument(_prev: unknown, formData: FormData) {
  const session = await getActionSession("patients:write");
  if ("error" in session) return actionError(session.error);

  const patientId = Number(formData.get("patientId"));
  const documentTypeId = Number(formData.get("documentTypeId"));
  const consultationRaw = formData.get("consultationId");
  const notes = formData.get("notes")?.toString() || undefined;
  const file = formData.get("file");

  if (!Number.isFinite(patientId) || patientId <= 0) {
    return actionError("Selecciona un paciente");
  }
  if (!Number.isFinite(documentTypeId) || documentTypeId <= 0) {
    return actionError("Selecciona un tipo de documento");
  }
  if (!(file instanceof File)) {
    return actionError("Archivo requerido");
  }

  const validation = validateClinicalDocumentFile(file);
  if (!validation.ok) return actionError(validation.error);

  try {
    const stored = await saveClinicalDocumentFile(patientId, file);

    const [document] = await db
      .insert(clinicalDocumentsTable)
      .values({
        patientId,
        consultationId: consultationRaw ? Number(consultationRaw) : null,
        documentTypeId,
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        notes,
        uploadedById: session.userId,
      })
      .returning({ id: clinicalDocumentsTable.id });

    await logActivity({
      userId: session.userId,
      module: "documentos",
      action: "cargar",
      recordId: document.id,
      detail: stored.fileName,
    });

    revalidatePath("/documentos");
    revalidatePath(`/pacientes/${patientId}`);

    return actionSuccess({ documentId: document.id, patientId });
  } catch (err) {
    console.error("[uploadClinicalDocument]", err);
    return actionError("No se pudo guardar el archivo");
  }
}
