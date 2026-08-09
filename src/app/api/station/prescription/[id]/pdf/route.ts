import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  stationKioskSessionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { buildPrescriptionPdf, calcAge } from "@/lib/pdf/prescription-pdf";
import { getPrescriptionSignature } from "@/lib/queries/signatures";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 401 });
    }

    const { id } = await params;
    const prescriptionId = Number(id);
    if (!Number.isFinite(prescriptionId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const [session] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.token, cookie.token));

    if (!session?.patientId) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 403 });
    }

    // jsonb may round-trip numbers as strings; coerce before compare
    const allowedId = Number(session.assessmentDraft?.prescriptionId);
    if (!Number.isFinite(allowedId) || allowedId !== prescriptionId) {
      return NextResponse.json({ error: "Receta no disponible en esta sesión" }, { status: 403 });
    }

    const [prescription] = await db
      .select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.id, prescriptionId));

    if (!prescription || prescription.patientId !== session.patientId) {
      return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
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
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[station/prescription/pdf]", error);
    const message =
      error instanceof Error && error.message.includes("ENOENT")
        ? "No se pudo generar el PDF (recursos del servidor). Intenta de nuevo."
        : "No se pudo generar el PDF de la receta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
