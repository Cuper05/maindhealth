import { NextResponse } from "next/server";
import { getLatestDeviceReadingsForAppointment } from "@/lib/queries/kiosk";
import { mergeVitalsDraft } from "@/lib/kiosk/vitals";
import type { KioskVitalsDraft } from "@/lib/db/schema/station-kiosk";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appointmentId = Number(searchParams.get("appointmentId"));
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 });
  }

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const rows = await getLatestDeviceReadingsForAppointment(appointmentId, since);

  let draft: KioskVitalsDraft = {};
  for (const row of rows) {
    draft = mergeVitalsDraft(draft, {
      systolicPressure: row.systolicPressure ?? undefined,
      diastolicPressure: row.diastolicPressure ?? undefined,
      heartRate: row.heartRate ?? undefined,
      oxygenSaturation: row.oxygenSaturation ?? undefined,
      temperature: row.temperature ?? undefined,
      weight: row.weight ?? undefined,
    });
  }

  return NextResponse.json({ draft, readingsCount: rows.length });
}
