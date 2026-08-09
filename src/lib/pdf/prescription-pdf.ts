import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { buildVerificationUrl } from "@/lib/prescriptions/folio";

export type PrescriptionPdfData = {
  chartNumber: string;
  patientName: string;
  patientAge?: string;
  doctorName: string;
  doctorLicense?: string | null;
  doctorSpecialty?: string | null;
  issuedAt: Date | string;
  prescriptionFolio?: string | null;
  verificationCode?: string | null;
  generalNotes?: string | null;
  items: {
    medication: string;
    dose?: string | null;
    frequency?: string | null;
    duration?: string | null;
    route?: string | null;
    instructions?: string | null;
  }[];
  signature?: {
    signerName: string;
    signerLicense?: string | null;
    signedAt: Date | string;
    signatureHash: string;
  };
};

function calcAge(birthDate: string | null | undefined) {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} años`;
}

function asText(value: unknown, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function buildPrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
  let qrBuffer: Buffer | undefined;
  if (data.prescriptionFolio) {
    try {
      qrBuffer = await QRCode.toBuffer(buildVerificationUrl(data.prescriptionFolio), {
        width: 120,
        margin: 1,
      });
    } catch {
      qrBuffer = undefined;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const issuedAt = asDate(data.issuedAt);

      doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f766e").text("MaindHealth", {
        align: "center",
      });
      doc.font("Helvetica").fontSize(12).fillColor("#334155").text("Receta médica electrónica", {
        align: "center",
      });
      if (qrBuffer) {
        doc.image(qrBuffer, doc.page.width - 150, 40, { width: 90 });
      }
      doc.moveDown(1.5);

      doc.fontSize(10).fillColor("#0f172a");
      if (data.prescriptionFolio) doc.text(`Folio: ${asText(data.prescriptionFolio)}`);
      if (data.verificationCode) doc.text(`Verificación: ${asText(data.verificationCode)}`);
      doc.text(`Expediente: ${asText(data.chartNumber)}`);
      doc.text(`Paciente: ${asText(data.patientName)}`);
      if (data.patientAge) doc.text(`Edad: ${asText(data.patientAge)}`);
      doc.text(
        `Fecha: ${issuedAt.toLocaleDateString("es-MX", {
          dateStyle: "long",
        })}`,
      );
      doc.moveDown();

      doc.text(`Médico: ${asText(data.doctorName)}`);
      if (data.doctorSpecialty) doc.text(`Especialidad: ${asText(data.doctorSpecialty)}`);
      if (data.doctorLicense) doc.text(`Cédula: ${asText(data.doctorLicense)}`);
      doc.moveDown();

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f766e").text("Medicamentos");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(10).fillColor("#0f172a");

      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        doc.text("Sin medicamentos registrados.");
      } else {
        items.forEach((item, index) => {
          doc.font("Helvetica-Bold").text(`${index + 1}. ${asText(item.medication, "Medicamento")}`);
          doc.font("Helvetica");
          const details = [
            item.dose && `Dosis: ${asText(item.dose)}`,
            item.frequency && `Frecuencia: ${asText(item.frequency)}`,
            item.duration && `Duración: ${asText(item.duration)}`,
            item.route && `Vía: ${asText(item.route)}`,
          ]
            .filter(Boolean)
            .join(" · ");
          if (details) doc.text(details);
          if (item.instructions) doc.text(`Indicaciones: ${asText(item.instructions)}`);
          doc.moveDown(0.5);
        });
      }

      if (data.generalNotes) {
        doc.moveDown();
        doc.font("Helvetica-Bold").text("Observaciones generales");
        doc.font("Helvetica").text(asText(data.generalNotes));
      }

      doc.moveDown(2);
      if (data.signature) {
        const signedAt = asDate(data.signature.signedAt);
        doc.text("_______________________________", { align: "center" });
        doc.text(asText(data.signature.signerName), { align: "center" });
        if (data.signature.signerLicense) {
          doc.text(`Cédula: ${asText(data.signature.signerLicense)}`, { align: "center" });
        }
        doc.fontSize(8).fillColor("#64748b").text(
          `Firma digital · ${signedAt.toLocaleString("es-MX")}`,
          { align: "center" },
        );
        const hash = asText(data.signature.signatureHash);
        if (hash) {
          doc.text(`Hash: ${hash.slice(0, 24)}…`, { align: "center" });
        }
      } else {
        doc.text("_______________________________", { align: "center" });
        doc.text("Firma del médico responsable (protocolo preautorizado)", {
          align: "center",
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export { calcAge };
