import { readFile } from "fs/promises";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolvePatientId } from "@/lib/auth/patient-scope";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { clinicalDocumentsTable } from "@/lib/db/schema";
import { resolveClinicalDocumentPath } from "@/lib/storage/clinical-documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "patients:view")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [document] = await db
    .select()
    .from(clinicalDocumentsTable)
    .where(eq(clinicalDocumentsTable.id, documentId));

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  if (session.role === "patient") {
    const patientId = await resolvePatientId(session);
    if (!patientId || patientId !== document.patientId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
  }

  try {
    const absolutePath = resolveClinicalDocumentPath(document.storagePath);
    const buffer = await readFile(absolutePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Content-Length": String(document.fileSize),
      },
    });
  } catch (err) {
    console.error("[documents/file]", err);
    return NextResponse.json(
      { error: "Archivo no disponible en el servidor" },
      { status: 404 },
    );
  }
}
