import { config } from "dotenv";
config({ path: ".env.local" });

import { desc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { stationKioskSessionsTable } from "../src/lib/db/schema";

async function main() {
  const rows = await db
    .select({
      id: stationKioskSessionsTable.id,
      appointmentId: stationKioskSessionsTable.appointmentId,
      status: stationKioskSessionsTable.status,
      deviceStatus: stationKioskSessionsTable.deviceStatus,
      currentStep: stationKioskSessionsTable.currentStep,
      updatedAt: stationKioskSessionsTable.updatedAt,
      createdAt: stationKioskSessionsTable.createdAt,
      draft: stationKioskSessionsTable.assessmentDraft,
    })
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.status, "waiting_doctor"))
    .orderBy(desc(stationKioskSessionsTable.updatedAt));

  console.log("count", rows.length);
  for (const r of rows) {
    const d =
      r.draft && typeof r.draft === "object"
        ? (r.draft as Record<string, unknown>)
        : {};
    console.log(
      JSON.stringify({
        id: r.id,
        appt: r.appointmentId,
        device: r.deviceStatus,
        step: r.currentStep,
        updatedAt: r.updatedAt,
        ageMin: Math.round(
          (Date.now() - new Date(r.updatedAt).getTime()) / 60000,
        ),
        videoOpened: d.videoOpened === true,
        doctorPresent: d.doctorPresent === true,
        callEnded: d.callEnded === true,
      }),
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
