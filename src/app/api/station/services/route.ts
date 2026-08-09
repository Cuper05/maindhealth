import { NextResponse } from "next/server";
import { listActiveStationServices } from "@/lib/kiosk/commerce";

export async function GET() {
  const services = await listActiveStationServices();
  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      amountCents: s.amountCents,
      currency: s.currency,
    })),
  });
}
