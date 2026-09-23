import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { appointmentsTable } from "../src/lib/db/schema";

const DOCTOR_ROOM = "maindhealth-appt-9-mudc922v";
const DOCTOR_URL = `https://maindhealth.daily.co/${DOCTOR_ROOM}`;
const APPT = Number(process.argv[2] || 10);

async function main() {
  await db
    .update(appointmentsTable)
    .set({
      meetingUrl: DOCTOR_URL,
      meetingRoomName: DOCTOR_ROOM,
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, APPT));

  const [row] = await db
    .select({
      id: appointmentsTable.id,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, APPT));
  console.log(JSON.stringify({ updated: row }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
