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
  issuedAt: Date;
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
    signedAt: Date;
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

export async function buildPrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
  let qrBuffer: Buffer | undefined;
  if (data.prescriptionFolio) {
    qrBuffer = await QRCode.toBuffer(buildVerificationUrl(data.prescriptionFolio), {
      width: 120,
      margin: 1,
    });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).fillColor("#0f766e").text("MaindHealth", { align: "center" });
    doc.fontSize(12).fillColor("#334155").text("Receta médica electrónica", { align: "center" });
    if (qrBuffer) {
      doc.image(qrBuffer, doc.page.width - 150, 40, { width: 90 });
    }
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor("#0f172a");
    if (data.prescriptionFolio) doc.text(`Folio: ${data.prescriptionFolio}`);
    if (data.verificationCode) doc.text(`Verificación: ${data.verificationCode}`);
    doc.text(`Expediente: ${data.chartNumber}`);
    doc.text(`Paciente: ${data.patientName}`);
    if (data.patientAge) doc.text(`Edad: ${data.patientAge}`);
    doc.text(
      `Fecha: ${data.issuedAt.toLocaleDateString("es-MX", {
        dateStyle: "long",
      })}`,
    );
    doc.moveDown();

    doc.text(`Médico: ${data.doctorName}`);
    if (data.doctorSpecialty) doc.text(`Especialidad: ${data.doctorSpecialty}`);
    if (data.doctorLicense) doc.text(`Cédula: ${data.doctorLicense}`);
    doc.moveDown();

    doc.fontSize(11).fillColor("#0f766e").text("Medicamentos");
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#0f172a");

    data.items.forEach((item, index) => {
      doc.font("Helvetica-Bold").text(`${index + 1}. ${item.medication}`);
      doc.font("Helvetica");
      const details = [
        item.dose && `Dosis: ${item.dose}`,
        item.frequency && `Frecuencia: ${item.frequency}`,
        item.duration && `Duración: ${item.duration}`,
        item.route && `Vía: ${item.route}`,
      ]
        .filter(Boolean)
        .join(" · ");
      if (details) doc.text(details);
      if (item.instructions) doc.text(`Indicaciones: ${item.instructions}`);
      doc.moveDown(0.5);
    });

    if (data.generalNotes) {
      doc.moveDown();
      doc.font("Helvetica-Bold").text("Observaciones generales");
      doc.font("Helvetica").text(data.generalNotes);
    }

    doc.moveDown(2);
    if (data.signature) {
      doc.text("_______________________________", { align: "center" });
      doc.text(data.signature.signerName, { align: "center" });
      if (data.signature.signerLicense) {
        doc.text(`Cédula: ${data.signature.signerLicense}`, { align: "center" });
      }
      doc.fontSize(8).fillColor("#64748b").text(
        `Firma digital · ${data.signature.signedAt.toLocaleString("es-MX")}`,
        { align: "center" },
      );
      doc.text(`Hash: ${data.signature.signatureHash.slice(0, 24)}…`, { align: "center" });
    } else {
      doc.text("_______________________________", { align: "center" });
      doc.text("Firma del médico", { align: "center" });
    }

    doc.end();
  });
}

export { calcAge };
