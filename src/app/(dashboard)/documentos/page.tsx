import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  catalogDocumentTypesTable,
  clinicalDocumentsTable,
  patientsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentosPage() {
  const session = await requireSession();
  const canUpload = can(session?.role, "patients:write");

  const rows = await db
    .select({
      id: clinicalDocumentsTable.id,
      fileName: clinicalDocumentsTable.fileName,
      mimeType: clinicalDocumentsTable.mimeType,
      fileSize: clinicalDocumentsTable.fileSize,
      notes: clinicalDocumentsTable.notes,
      uploadedAt: clinicalDocumentsTable.uploadedAt,
      typeName: catalogDocumentTypesTable.name,
      chartNumber: patientsTable.chartNumber,
      patientId: patientsTable.id,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      uploaderFirstName: usersTable.firstName,
      uploaderLastNamePaternal: usersTable.lastNamePaternal,
      uploaderLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(clinicalDocumentsTable)
    .innerJoin(
      catalogDocumentTypesTable,
      eq(clinicalDocumentsTable.documentTypeId, catalogDocumentTypesTable.id),
    )
    .innerJoin(patientsTable, eq(clinicalDocumentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(clinicalDocumentsTable.uploadedById, usersTable.id))
    .orderBy(desc(clinicalDocumentsTable.uploadedAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Documentos clínicos"
        description="PDFs, laboratorios, imágenes y reportes del expediente."
        action={
          canUpload ? (
            <Link href="/documentos/nuevo" className={buttonPrimaryClassName}>
              + Cargar documento
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Archivo</th>
              <th className="px-4 py-3 font-medium">Tamaño</th>
              <th className="px-4 py-3 font-medium">Cargado por</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Sin documentos cargados.
                  {canUpload && (
                    <>
                      {" "}
                      <Link
                        href="/documentos/nuevo"
                        className="text-teal-700 hover:underline"
                      >
                        Cargar el primero
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.uploadedAt.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/pacientes/${row.patientId}?tab=documentos`}
                      className="text-teal-700 hover:underline"
                    >
                      <span className="font-mono text-xs text-slate-500">
                        {row.chartNumber}
                      </span>
                      <br />
                      {formatPersonName({
                        firstName: row.patientFirstName,
                        lastNamePaternal: row.patientLastNamePaternal,
                        lastNameMaternal: row.patientLastNameMaternal,
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.typeName}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{row.fileName}</td>
                  <td className="px-4 py-3">{formatFileSize(row.fileSize)}</td>
                  <td className="px-4 py-3">
                    {formatPersonName({
                      firstName: row.uploaderFirstName,
                      lastNamePaternal: row.uploaderLastNamePaternal,
                      lastNameMaternal: row.uploaderLastNameMaternal,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/documents/${row.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-700 hover:underline"
                    >
                      Ver
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
