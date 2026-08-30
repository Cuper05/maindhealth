import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { stationDbErrorResponse } from "@/lib/db/errors";
import {
  dismissWaitingDoctorForAppointment,
  getWaitingDoctorStationSessions,
} from "@/lib/queries/station-waiting";

export async function GET() {
  const session = await requireSession();
  if (!session || !can(session.role, "intake:view")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const waiting = await getWaitingDoctorStationSessions();
    return NextResponse.json({
      waiting: waiting.map((item) => ({
        sessionId: item.sessionId,
        appointmentId: item.appointmentId,
        patientId: item.patientId,
        chartNumber: item.chartNumber,
        patientName: item.patientName,
        doctorName: item.doctorName,
        meetingUrl: item.meetingUrl,
        modality: item.modality,
        updatedAt: item.updatedAt,
        redFlags: item.redFlags,
        summary: item.summary,
      })),
    });
  } catch (error) {
    return stationDbErrorResponse(error, "No se pudo consultar la cola de teleconsulta");
  }
}

/** Descarta una espera fantasma (Cancelar / No abrir en la Dell). */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session || !can(session.role, "intake:view")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    appointmentId?: number;
  };
  if (body.action !== "dismiss") {
    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  }
  const appointmentId = Number(body.appointmentId);
  if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
    return NextResponse.json({ error: "appointmentId inválido" }, { status: 400 });
  }

  const updated = await dismissWaitingDoctorForAppointment(appointmentId);
  return NextResponse.json({ ok: true, updated });
}
