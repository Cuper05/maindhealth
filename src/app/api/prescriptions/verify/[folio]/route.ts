import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folio: string }> },
) {
  const { folio } = await params;
  const decoded = decodeURIComponent(folio);

  const [prescription] = await db
    .select()
    .from(prescriptionsTable)
    .where(eq(prescriptionsTable.prescriptionFolio, decoded));

  if (!prescription) {
    return NextResponse.json({ valid: false, error: "Receta no encontrada" }, { status: 404 });
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
    .where(eq(prescriptionItemsTable.prescriptionId, prescription.id));

  return NextResponse.json({
    valid: true,
    folio: prescription.prescriptionFolio,
    verificationCode: prescription.verificationCode,
    issuedAt: prescription.issuedAt,
    patient: patient
      ? { chartNumber: patient.chartNumber, name: formatPersonName(patient) }
      : null,
    doctor: doctor ? { name: formatPersonName(doctor), license: doctor.professionalLicense } : null,
    items: items.map((i) => ({
      medication: i.medication,
      dose: i.dose,
      frequency: i.frequency,
    })),
  });
}
