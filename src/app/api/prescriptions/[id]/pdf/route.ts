import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolvePatientId } from "@/lib/auth/patient-scope";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { buildPrescriptionPdf, calcAge } from "@/lib/pdf/prescription-pdf";
import { getPrescriptionSignature } from "@/lib/queries/signatures";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "prescriptions:view")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const prescriptionId = Number(id);
  if (!Number.isFinite(prescriptionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [prescription] = await db
    .select()
    .from(prescriptionsTable)
    .where(eq(prescriptionsTable.id, prescriptionId));

  if (!prescription) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }

  if (session.role === "patient") {
    const patientId = await resolvePatientId(session);
    if (!patientId || patientId !== prescription.patientId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
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
    return NextResponse.json({ error: "Datos incompletos" }, { status: 404 });
  }

  const signature = await getPrescriptionSignature(prescriptionId);

  const pdf = await buildPrescriptionPdf({
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
    signature: signature
      ? {
          signerName: signature.signerName,
          signerLicense: signature.signerLicense,
          signedAt: signature.signedAt,
          signatureHash: signature.signatureHash,
        }
      : undefined,
  });

  const filename = `receta-${patient.chartNumber}-${prescriptionId}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
