import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  stationKioskSessionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import {
  buildPrescriptionPdf,
  calcAge,
  type PrescriptionPdfData,
} from "@/lib/pdf/prescription-pdf";
import { getPrescriptionSignature } from "@/lib/queries/signatures";

export type StationPrescriptionResult =
  | { ok: true; data: PrescriptionPdfData; filenameBase: string }
  | { ok: false; status: number; error: string };

export async function loadStationPrescription(
  token: string,
  prescriptionId: number,
): Promise<StationPrescriptionResult> {
  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, token));

  if (!session?.patientId) {
    return { ok: false, status: 403, error: "Sesión inválida" };
  }

  const allowedId = Number(session.assessmentDraft?.prescriptionId);
  if (!Number.isFinite(allowedId) || allowedId !== prescriptionId) {
    return { ok: false, status: 403, error: "Receta no disponible en esta sesión" };
  }

  const [prescription] = await db
    .select()
    .from(prescriptionsTable)
    .where(eq(prescriptionsTable.id, prescriptionId));

  if (!prescription || prescription.patientId !== session.patientId) {
    return { ok: false, status: 404, error: "Receta no encontrada" };
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, prescription.patientId));

  const [doctor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, prescription.doctorId));

  const items = await db
    .select()
    .from(prescriptionItemsTable)
    .where(eq(prescriptionItemsTable.prescriptionId, prescriptionId));

  if (!patient || !doctor) {
    return { ok: false, status: 404, error: "Datos incompletos" };
  }

  const signature = await getPrescriptionSignature(prescriptionId);

  const data: PrescriptionPdfData = {
    chartNumber: patient.chartNumber,
    patientName: formatPersonName(patient),
    patientAge: calcAge(patient.birthDate ?? undefined),
    doctorName: formatPersonName(doctor),
    doctorLicense: doctor.professionalLicense,
    doctorSpecialty: doctor.specialty,
    issuedAt: prescription.issuedAt,
    prescriptionFolio: prescription.prescriptionFolio,
    verificationCode: prescription.verificationCode,
    generalNotes: prescription.generalNotes,
    items,
    // Los signos vitales de la sesión se imprimen como referencia para el paciente.
    vitals: session.vitalsDraft ?? null,
    signature: signature
      ? {
          signerName: signature.signerName,
          signerLicense: signature.signerLicense,
          signedAt: signature.signedAt,
          signatureHash: signature.signatureHash,
        }
      : undefined,
  };

  return {
    ok: true,
    data,
    filenameBase: `receta-${patient.chartNumber}-${prescriptionId}`,
  };
}

export async function buildStationPrescriptionPdf(token: string, prescriptionId: number) {
  const loaded = await loadStationPrescription(token, prescriptionId);
  if (!loaded.ok) return loaded;
  const pdf = await buildPrescriptionPdf(loaded.data);
  return { ok: true as const, pdf, filenameBase: loaded.filenameBase };
}
