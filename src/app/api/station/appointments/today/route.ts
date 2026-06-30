import { NextResponse } from "next/server";
import { getTodayKioskAppointments } from "@/lib/queries/kiosk";

export async function GET() {
  const appointments = await getTodayKioskAppointments();
  return NextResponse.json({ appointments });
}
