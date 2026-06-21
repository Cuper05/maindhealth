import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deviceReadingsTable, patientsTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function getDeviceReadings(medicalDeviceId: number) {
  return db
    .select({
      id: deviceReadingsTable.id,
      recordedAt: deviceReadingsTable.recordedAt,
      systolicPressure: deviceReadingsTable.systolicPressure,
      diastolicPressure: deviceReadingsTable.diastolicPressure,
      heartRate: deviceReadingsTable.heartRate,
      oxygenSaturation: deviceReadingsTable.oxygenSaturation,
      temperature: deviceReadingsTable.temperature,
      weight: deviceReadingsTable.weight,
      glucose: deviceReadingsTable.glucose,
      source: deviceReadingsTable.source,
      notes: deviceReadingsTable.notes,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(deviceReadingsTable)
    .leftJoin(patientsTable, eq(deviceReadingsTable.patientId, patientsTable.id))
    .where(eq(deviceReadingsTable.medicalDeviceId, medicalDeviceId))
    .orderBy(desc(deviceReadingsTable.recordedAt))
    .limit(50)
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        patientName: row.patientFirstName
          ? formatPersonName({
              firstName: row.patientFirstName,
              lastNamePaternal: row.patientLastNamePaternal ?? "",
              lastNameMaternal: row.patientLastNameMaternal,
            })
          : null,
      })),
    );
}
