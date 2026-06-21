import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncClinicalAlertsFromVitals } from "@/lib/alerts/sync-from-vitals";
import { db } from "@/lib/db";
import {
  deviceReadingsTable,
  medicalDevicesTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { deviceIngestSchema } from "@/lib/validators/phase4";

export async function POST(request: Request) {
  const apiKey = process.env.DEVICE_INGEST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEVICE_INGEST_API_KEY no configurada" },
      { status: 503 },
    );
  }

  if (request.headers.get("x-api-key") !== apiKey) {
    return NextResponse.json({ error: "API key inválida" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = deviceIngestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload inválido" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  let medicalDeviceId = data.medicalDeviceId;

  if (!medicalDeviceId && data.serialNumber) {
    const [device] = await db
      .select({ id: medicalDevicesTable.id })
      .from(medicalDevicesTable)
      .where(eq(medicalDevicesTable.serialNumber, data.serialNumber));
    medicalDeviceId = device?.id;
  }

  if (!medicalDeviceId) {
    return NextResponse.json({ error: "Equipo no identificado" }, { status: 400 });
  }

  let vitalSignId: number | undefined;
  if (data.syncToVitals !== false && data.patientId) {
    const [vital] = await db
      .insert(vitalSignsTable)
      .values({
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        systolicPressure: data.systolicPressure,
        diastolicPressure: data.diastolicPressure,
        heartRate: data.heartRate,
        oxygenSaturation: data.oxygenSaturation,
        temperature: data.temperature,
        weight: data.weight,
        glucose: data.glucose,
      })
      .returning({ id: vitalSignsTable.id });
    vitalSignId = vital.id;

    await syncClinicalAlertsFromVitals({
      patientId: data.patientId,
      vitalSignId,
      systolicPressure: data.systolicPressure,
      diastolicPressure: data.diastolicPressure,
      heartRate: data.heartRate,
      oxygenSaturation: data.oxygenSaturation,
      temperature: data.temperature,
      glucose: data.glucose,
      source: "hardware-api",
    });
  }

  const [reading] = await db
    .insert(deviceReadingsTable)
    .values({
      medicalDeviceId,
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      vitalSignId,
      rawPayload: json,
      systolicPressure: data.systolicPressure,
      diastolicPressure: data.diastolicPressure,
      heartRate: data.heartRate,
      oxygenSaturation: data.oxygenSaturation,
      temperature: data.temperature,
      weight: data.weight,
      glucose: data.glucose,
      source: "hardware-api",
    })
    .returning({ id: deviceReadingsTable.id });

  return NextResponse.json({ ok: true, readingId: reading.id, vitalSignId });
}
