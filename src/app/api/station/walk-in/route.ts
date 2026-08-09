import { NextResponse } from "next/server";
import { startWalkInForExistingPatient } from "@/lib/kiosk/walk-in";

export async function POST(request: Request) {
  const body = await request.json();
  const patientId = Number(body.patientId);
  if (!Number.isFinite(patientId)) {
    return NextResponse.json({ error: "Paciente no válido" }, { status: 400 });
  }
  const result = await startWalkInForExistingPatient(patientId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
