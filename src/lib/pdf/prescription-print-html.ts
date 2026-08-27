import QRCode from "qrcode";
import { buildVerificationUrl } from "@/lib/prescriptions/folio";
import {
  formatPrescriptionVitals,
  PRESCRIPTION_VITALS_NOTE,
  PRESCRIPTION_VITALS_TITLE,
  type PrescriptionPdfData,
} from "@/lib/pdf/prescription-pdf";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** HTML listo para imprimir en kiosko (sin visor PDF / sin Guardar como archivo). */
export async function buildPrescriptionPrintHtml(data: PrescriptionPdfData): Promise<string> {
  const issuedAt = asDate(data.issuedAt);
  let qrImg = "";
  if (data.prescriptionFolio) {
    try {
      const qr = await QRCode.toDataURL(buildVerificationUrl(data.prescriptionFolio), {
        width: 120,
        margin: 1,
      });
      qrImg = `<img class="qr" src="${qr}" alt="QR verificación" width="96" height="96" />`;
    } catch {
      qrImg = "";
    }
  }

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsHtml =
    items.length === 0
      ? `<p>Sin medicamentos registrados.</p>`
      : items
          .map((item, index) => {
            const details = [
              item.dose && `Dosis: ${esc(item.dose)}`,
              item.frequency && `Frecuencia: ${esc(item.frequency)}`,
              item.duration && `Duración: ${esc(item.duration)}`,
              item.route && `Vía: ${esc(item.route)}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return `<div class="med">
              <p class="med-title">${index + 1}. ${esc(item.medication || "Medicamento")}</p>
              ${details ? `<p class="med-details">${details}</p>` : ""}
              ${item.instructions ? `<p class="med-details">Indicaciones: ${esc(item.instructions)}</p>` : ""}
            </div>`;
          })
          .join("");

  const vitalLines = formatPrescriptionVitals(data.vitals);
  const vitalsHtml =
    vitalLines.length === 0
      ? ""
      : `<h2>${esc(PRESCRIPTION_VITALS_TITLE)}</h2>
        <ul class="vitals">
          ${vitalLines.map((line) => `<li>${esc(line)}</li>`).join("")}
        </ul>
        <p class="muted">${esc(PRESCRIPTION_VITALS_NOTE)}</p>`;

  let signatureHtml = `
    <div class="sign">
      <p>_______________________________</p>
      <p>Firma del médico responsable (protocolo preautorizado)</p>
    </div>`;
  if (data.signature) {
    const signedAt = asDate(data.signature.signedAt);
    const hash = String(data.signature.signatureHash || "");
    signatureHtml = `
      <div class="sign">
        <p>_______________________________</p>
        <p><strong>${esc(data.signature.signerName)}</strong></p>
        ${data.signature.signerLicense ? `<p>Cédula: ${esc(data.signature.signerLicense)}</p>` : ""}
        <p class="muted">Firma digital · ${esc(signedAt.toLocaleString("es-MX"))}</p>
        ${hash ? `<p class="muted">Hash: ${esc(hash.slice(0, 24))}…</p>` : ""}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receta ${esc(data.prescriptionFolio || "")}</title>
  <style>
    @page { size: letter; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: #fff;
      font-size: 12pt;
      line-height: 1.35;
    }
    .sheet { padding: 8mm; max-width: 190mm; margin: 0 auto; }
    .header { text-align: center; position: relative; padding-right: 110px; min-height: 90px; }
    .brand { color: #0f766e; font-size: 20pt; font-weight: 700; margin: 0; }
    .sub { color: #334155; margin: 4px 0 0; font-size: 12pt; }
    .qr { position: absolute; right: 0; top: 0; }
    .meta { margin-top: 18px; }
    .meta p { margin: 2px 0; }
    h2 { color: #0f766e; font-size: 13pt; margin: 18px 0 8px; }
    .med { margin-bottom: 10px; }
    .med-title { font-weight: 700; margin: 0 0 2px; }
    .med-details { margin: 0; color: #1e293b; }
    .vitals { margin: 0 0 4px; padding-left: 20px; }
    .vitals li { margin: 2px 0; }
    .sign { margin-top: 36px; text-align: center; }
    .sign p { margin: 2px 0; }
    .muted { color: #64748b; font-size: 9pt; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <p class="brand">MaindHealth</p>
      <p class="sub">Receta médica electrónica</p>
      ${qrImg}
    </div>
    <div class="meta">
      ${data.prescriptionFolio ? `<p><strong>Folio:</strong> ${esc(data.prescriptionFolio)}</p>` : ""}
      ${data.verificationCode ? `<p><strong>Verificación:</strong> ${esc(data.verificationCode)}</p>` : ""}
      <p><strong>Expediente:</strong> ${esc(data.chartNumber)}</p>
      <p><strong>Paciente:</strong> ${esc(data.patientName)}</p>
      ${data.patientAge ? `<p><strong>Edad:</strong> ${esc(data.patientAge)}</p>` : ""}
      <p><strong>Fecha:</strong> ${esc(issuedAt.toLocaleDateString("es-MX", { dateStyle: "long" }))}</p>
      <p><strong>Médico:</strong> ${esc(data.doctorName)}</p>
      ${data.doctorSpecialty ? `<p><strong>Especialidad:</strong> ${esc(data.doctorSpecialty)}</p>` : ""}
      ${data.doctorLicense ? `<p><strong>Cédula:</strong> ${esc(data.doctorLicense)}</p>` : ""}
    </div>
    <h2>Medicamentos</h2>
    ${itemsHtml}
    ${
      data.generalNotes
        ? `<h2>Observaciones generales</h2><p>${esc(data.generalNotes)}</p>`
        : ""
    }
    ${vitalsHtml}
    ${signatureHtml}
  </div>
</body>
</html>`;
}
