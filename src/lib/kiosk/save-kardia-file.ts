import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stationKioskSessionsTable } from "@/lib/db/schema";
import { fileToKardiaPatch, publicVitalsDraft } from "@/lib/kiosk/kardia";
import { mergeVitalsDraft } from "@/lib/kiosk/vitals";

export async function saveKardiaFileToSession(token: string, file: File) {
  const [current] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, token));

  if (!current || current.status !== "active") {
    return NextResponse.json({ error: "Sesión no válida o ya cerrada." }, { status: 404 });
  }

  const parsed = await fileToKardiaPatch(file);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const vitalsDraft = mergeVitalsDraft(current.vitalsDraft, parsed.patch);
  await db
    .update(stationKioskSessionsTable)
    .set({
      vitalsDraft,
      deviceStatus: "done",
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, token));

  return NextResponse.json({
    ok: true,
    vitalsDraft: publicVitalsDraft(vitalsDraft),
  });
}
