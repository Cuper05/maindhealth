import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/mobile-token";
import { getKioskSessionByAppointment } from "@/lib/queries/kiosk-session";
import { db } from "@/lib/db";
import { appointmentsTable, patientsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatPersonName } from "@/lib/format/name";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/** Detalle clínico de una teleconsulta para la app móvil del médico. */
export async function GET(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const auth = requireMobileAuth(request);
  if (!auth) {
    return withCors(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
  }

  try {
    const { appointmentId: raw } = await context.params;
    const appointmentId = Number(raw);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return withCors(NextResponse.json({ error: "Cita inválida" }, { status: 400 }));
    }

    const [appointment] = await db
      .select({
        id: appointmentsTable.id,
        reason: appointmentsTable.reason,
        meetingUrl: appointmentsTable.meetingUrl,
        patientId: appointmentsTable.patientId,
        firstName: patientsTable.firstName,
        lastNamePaternal: patientsTable.lastNamePaternal,
        lastNameMaternal: patientsTable.lastNameMaternal,
        chartNumber: patientsTable.chartNumber,
        birthDate: patientsTable.birthDate,
        sex: patientsTable.sex,
        phone: patientsTable.phone,
      })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .where(eq(appointmentsTable.id, appointmentId))
      .limit(1);

    if (!appointment) {
      return withCors(NextResponse.json({ error: "Cita no encontrada" }, { status: 404 }));
    }

    const kiosk = await getKioskSessionByAppointment(appointmentId);
    const clinical = kiosk?.clinicalDraft ?? {};
    const crisis =
      clinical.crisisMode === true ||
      clinical.crisisIntent === true ||
      (appointment.firstName === "Paciente" &&
        appointment.lastNamePaternal === "Urgencia");

    return withCors(
      NextResponse.json({
        ok: true,
        appointment: {
          id: appointment.id,
          reason: appointment.reason,
          meetingUrl: appointment.meetingUrl,
          patientId: appointment.patientId,
          patientName: formatPersonName({
            firstName: appointment.firstName,
            lastNamePaternal: appointment.lastNamePaternal,
            lastNameMaternal: appointment.lastNameMaternal,
          }),
          chartNumber: appointment.chartNumber,
          birthDate: appointment.birthDate,
          sex: appointment.sex,
          phone: appointment.phone,
          crisis,
        },
        kiosk: kiosk
          ? {
              clinicalDraft: kiosk.clinicalDraft,
              vitalsDraft: kiosk.vitalsDraft,
              assessmentDraft: kiosk.assessmentDraft,
              paymentStatus: kiosk.paymentStatus,
            }
          : null,
      }),
    );
  } catch (err) {
    console.error("[mobile/teleconsultas/[id]]", err);
    return withCors(NextResponse.json({ error: "Error al cargar" }, { status: 500 }));
  }
}
