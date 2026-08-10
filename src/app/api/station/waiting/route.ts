import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getWaitingDoctorStationSessions } from "@/lib/queries/station-waiting";

export async function GET() {
  const session = await requireSession();
  if (!session || !can(session.role, "intake:view")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
}
