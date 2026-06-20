import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "clinical-documents");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateClinicalDocumentFile(file: File) {
  if (!file || file.size === 0) {
    return { ok: false as const, error: "Selecciona un archivo" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false as const, error: "El archivo no puede superar 10 MB" };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false as const,
      error: "Formato no permitido. Usa PDF, JPG, PNG o WEBP",
    };
  }
  return { ok: true as const };
}

export async function saveClinicalDocumentFile(patientId: number, file: File) {
  const patientDir = path.join(STORAGE_ROOT, String(patientId));
  await mkdir(patientDir, { recursive: true });

  const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${safeBaseName}`;
  const absolutePath = path.join(patientDir, storedName);
  const relativePath = path.join(String(patientId), storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    storagePath: relativePath,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  };
}

export function resolveClinicalDocumentPath(relativePath: string) {
  const absolute = path.join(STORAGE_ROOT, relativePath);
  const normalizedRoot = path.normalize(STORAGE_ROOT);
  const normalizedFile = path.normalize(absolute);
  if (!normalizedFile.startsWith(normalizedRoot)) {
    throw new Error("Ruta de archivo inválida");
  }
  return normalizedFile;
}

export { STORAGE_ROOT };
