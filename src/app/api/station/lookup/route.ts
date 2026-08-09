import { NextResponse } from "next/server";
import { lookupPatientForKiosk } from "@/lib/queries/kiosk";

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
  return NextResponse.json({ patient });
}
