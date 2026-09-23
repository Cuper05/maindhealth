import { config } from "dotenv";
config({ path: ".env.local" });

import { desc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  appointmentsTable,
  teleconsultaAlertAttemptsTable,
  teleconsultaEscalationsTable,
  teleconsultaJoinTokensTable,
} from "../src/lib/db/schema";

async function main() {
  const apptId = Number(process.argv[2] || 10);
  const [a] = await db
    .select({
      id: appointmentsTable.id,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
      modality: appointmentsTable.modality,
      doctorId: appointmentsTable.doctorId,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, apptId));
  const tokens = await db
    .select({
      id: teleconsultaJoinTokensTable.id,
      usedAt: teleconsultaJoinTokensTable.usedAt,
      revokedAt: teleconsultaJoinTokensTable.revokedAt,
      createdAt: teleconsultaJoinTokensTable.createdAt,
    })
    .from(teleconsultaJoinTokensTable)
    .where(eq(teleconsultaJoinTokensTable.appointmentId, apptId))
    .orderBy(desc(teleconsultaJoinTokensTable.id));
  const [esc] = await db
    .select({
      status: teleconsultaEscalationsTable.status,
      joinedByUserId: teleconsultaEscalationsTable.joinedByUserId,
      joinedAt: teleconsultaEscalationsTable.joinedAt,
    })
    .from(teleconsultaEscalationsTable)
    .where(eq(teleconsultaEscalationsTable.appointmentId, apptId));
  const attempts = await db
    .select({
      id: teleconsultaAlertAttemptsTable.id,
      status: teleconsultaAlertAttemptsTable.status,
      voice: teleconsultaAlertAttemptsTable.voiceCallSid,
      sms: teleconsultaAlertAttemptsTable.smsSid,
    })
    .from(teleconsultaAlertAttemptsTable)
    .where(eq(teleconsultaAlertAttemptsTable.appointmentId, apptId));
  console.log(
    JSON.stringify(
      {
        appointment: a,
        escalation: esc,
        tokens: tokens.map((t) => ({
          id: t.id,
          used: Boolean(t.usedAt),
          revoked: Boolean(t.revokedAt),
          usedAt: t.usedAt,
        })),
        attempts,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
