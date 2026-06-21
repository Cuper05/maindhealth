import { createHash } from "crypto";

export function buildPrescriptionFolio(prescriptionId: number, issuedAt = new Date()) {
  const year = issuedAt.getFullYear();
  const folio = `MH-RX-${year}-${String(prescriptionId).padStart(6, "0")}`;
  const verificationCode = createHash("sha256")
    .update(`${folio}:${prescriptionId}:${issuedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
  return { folio, verificationCode };
}

export function buildVerificationUrl(folio: string, baseUrl?: string) {
  const origin = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3003";
  return `${origin}/api/prescriptions/verify/${encodeURIComponent(folio)}`;
}
