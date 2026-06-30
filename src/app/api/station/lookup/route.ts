import { NextResponse } from "next/server";
import { getTodayKioskAppointments, lookupPatientForKiosk } from "@/lib/queries/kiosk";

export async function POST(request: Request) {
  const body = await request.json();
  const query = {
    chartNumber: body.chartNumber?.trim() || undefined,
    phone: body.phone?.trim() || undefined,
    email: body.email?.trim() || undefined,
    curp: body.curp?.trim() || undefined,
    firstName: body.firstName?.trim() || undefined,
    lastNamePaternal: body.lastNamePaternal?.trim() || undefined,
    birthDate: body.birthDate?.trim() || undefined,
  };
  const patient = await lookupPatientForKiosk(query);
  if (!patient) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }
  const appointments = await getTodayKioskAppointments();
  const todayAppointment = appointments.find((a) => a.patientId === patient.id && !a.intakeComplete);
  return NextResponse.json({ patient, todayAppointment: todayAppointment ?? null });
}
