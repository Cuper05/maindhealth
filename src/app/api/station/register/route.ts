import { NextResponse } from "next/server";
import { registerKioskWalkIn } from "@/lib/kiosk/register";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await registerKioskWalkIn(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
