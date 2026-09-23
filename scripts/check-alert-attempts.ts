import { config } from "dotenv";
config({ path: ".env.local" });

import { desc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  teleconsultaAlertAttemptsTable,
  teleconsultaEscalationsTable,
} from "../src/lib/db/schema";
import { getWaitingDoctorStationSessions } from "../src/lib/queries/station-waiting";

async function main() {
  const waiting = await getWaitingDoctorStationSessions();
  const attempts = await db
    .select({
      id: teleconsultaAlertAttemptsTable.id,
      appt: teleconsultaAlertAttemptsTable.appointmentId,
      status: teleconsultaAlertAttemptsTable.status,
      voice: teleconsultaAlertAttemptsTable.voiceCallSid,
      sms: teleconsultaAlertAttemptsTable.smsSid,
      error: teleconsultaAlertAttemptsTable.errorDetail,
      at: teleconsultaAlertAttemptsTable.alertedAt,
    })
    .from(teleconsultaAlertAttemptsTable)
    .orderBy(desc(teleconsultaAlertAttemptsTable.id))
    .limit(8);
  const escs = await db
    .select({
      id: teleconsultaEscalationsTable.id,
      appt: teleconsultaEscalationsTable.appointmentId,
      status: teleconsultaEscalationsTable.status,
      idx: teleconsultaEscalationsTable.indexInQueue,
      next: teleconsultaEscalationsTable.nextActionAt,
    })
    .from(teleconsultaEscalationsTable)
    .orderBy(desc(teleconsultaEscalationsTable.id))
    .limit(5);
  console.log(
    JSON.stringify(
      {
        waiting: waiting.map((w) => w.appointmentId),
        escalations: escs,
        attempts,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
