import { NextResponse } from "next/server";
import { saveKioskVisitIntake } from "@/lib/kiosk/intake";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await saveKioskVisitIntake(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
