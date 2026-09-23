import type { KioskVitalsDraft } from "@/lib/db/schema/station-kiosk";

export const KARDIA_PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.alivecor.aliveecg";
export const KARDIA_APP_STORE = "https://apps.apple.com/app/kardia/id941379119";

const MAX_BYTES = 4 * 1024 * 1024;

export function publicVitalsDraft(
  draft: KioskVitalsDraft | null | undefined,
): KioskVitalsDraft {
  if (!draft) return {};
  const { ecgKardiaData: _omit, ...rest } = draft;
  return rest;
}

export function sniffKardiaMime(
  bytes: Uint8Array,
  fileName: string,
  declared: string,
): string | null {
  const type = (declared || "").toLowerCase();
  if (
    type === "application/pdf" ||
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp"
  ) {
    return type;
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44) {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export async function fileToKardiaPatch(file: File): Promise<
  | { ok: true; patch: Partial<KioskVitalsDraft> }
  | { ok: false; error: string }
> {
  if (!file || file.size === 0) {
    return { ok: false, error: "Seleccione el PDF o la imagen del ECG de Kardia." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "El archivo no puede superar 4 MB." };
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const mime = sniffKardiaMime(buf, file.name, file.type);
  if (!mime) {
    return { ok: false, error: "Use el PDF de Kardia, o una foto JPG/PNG de la pantalla." };
  }
  const b64 = Buffer.from(buf).toString("base64");
  return {
    ok: true,
    patch: {
      ecgStatus: "done",
      ecgRhythm: "KardiaMobile (PDF para el médico)",
      ecgSource: "kardia",
      ecgKardiaReady: "1",
      ecgKardiaFileName: file.name.replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, "_").slice(0, 180),
      ecgKardiaMime: mime,
      ecgKardiaData: b64,
    },
  };
}
