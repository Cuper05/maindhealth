import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncClinicalAlertsFromVitals } from "@/lib/alerts/sync-from-vitals";
import { db } from "@/lib/db";
import { stationKioskSessionsTable, vitalSignsTable } from "@/lib/db/schema";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { isVitalsComplete, mergeVitalsDraft } from "@/lib/kiosk/vitals";
import { computeBmi } from "@/lib/validators/vitals";

export async function PATCH(request: Request) {
  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 400 });
  }

  const body = await request.json();
  const [current] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, cookie.token));

  if (!current) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const vitalsDraft = mergeVitalsDraft(current.vitalsDraft, body.patch ?? {});
  const [session] = await db
    .update(stationKioskSessionsTable)
    .set({
      vitalsDraft,
      deviceStatus: body.deviceStatus ?? current.deviceStatus,
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, cookie.token))
    .returning();

  return NextResponse.json({ vitalsDraft: session.vitalsDraft });
}

export async function POST(request: Request) {
  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 400 });
  }

  const [current] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, cookie.token));

  if (!current?.patientId || !current.appointmentId) {
    return NextResponse.json({ error: "Paciente o cita no definidos" }, { status: 400 });
  }

  const draft = current.vitalsDraft ?? {};
  if (!isVitalsComplete(draft)) {
    return NextResponse.json({ error: "Signos vitales incompletos" }, { status: 400 });
  }

  let bmi: string | null = draft.bmi ?? null;
  if (!bmi && draft.weight && draft.height) {
    const computed = computeBmi(Number(draft.weight), Number(draft.height));
    if (computed != null) bmi = String(computed);
  }

  const [record] = await db
    .insert(vitalSignsTable)
    .values({
      patientId: current.patientId,
      appointmentId: current.appointmentId,
      systolicPressure: draft.systolicPressure,
      diastolicPressure: draft.diastolicPressure,
      heartRate: draft.heartRate,
      oxygenSaturation: draft.oxygenSaturation,
      temperature: draft.temperature,
      weight: draft.weight,
      height: draft.height,
      bmi,
      symptoms: "Captura estación paciente",
      deviceExtras: {
        source: "kiosk",
        ecgStatus: draft.ecgStatus ?? null,
        ecgRhythm: draft.ecgRhythm ?? null,
        ecgHeartRate: draft.ecgHeartRate ?? null,
      },
    })
    .returning({ id: vitalSignsTable.id });

  await syncClinicalAlertsFromVitals({
    patientId: current.patientId,
    vitalSignId: record.id,
    systolicPressure: draft.systolicPressure,
    diastolicPressure: draft.diastolicPressure,
    heartRate: draft.heartRate,
    oxygenSaturation: draft.oxygenSaturation,
    temperature: draft.temperature,
    source: "kiosk",
  });

  await db
    .update(stationKioskSessionsTable)
    .set({ vitalSignId: record.id, updatedAt: new Date() })
    .where(eq(stationKioskSessionsTable.token, cookie.token));

  return NextResponse.json({ ok: true, vitalSignId: record.id });
}
