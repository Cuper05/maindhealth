import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { stationKioskSessionsTable } from "../src/lib/db/schema";

async function main() {
  const id = Number(process.argv[2] || 11);
  const [row] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.id, id));
  if (!row) {
    console.log("NO_SESSION");
    return;
  }
  const draft =
    row.assessmentDraft && typeof row.assessmentDraft === "object"
      ? { ...(row.assessmentDraft as Record<string, unknown>) }
      : {};
  delete draft.callEnded;
  delete draft.callEndedAt;
  delete draft.closedReason;
  draft.doctorPresent = true;
  await db
    .update(stationKioskSessionsTable)
    .set({
      status: "waiting_doctor",
      currentStep: "waiting",
      deviceStatus: "doctor_live",
      assessmentDraft: draft as typeof row.assessmentDraft,
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.id, id));
  console.log("RESTORED", { id, appt: row.appointmentId });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
