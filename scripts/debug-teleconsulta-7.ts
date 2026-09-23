import { config } from "dotenv";
config({ path: ".env.local" });

import { desc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  appointmentsTable,
  notificationsTable,
  pushTokensTable,
  rolesTable,
  teleconsultaAlertAttemptsTable,
  teleconsultaEscalationsTable,
  usersTable,
} from "../src/lib/db/schema";

async function main() {
  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, 7));
  console.log(
    "APPT",
    JSON.stringify(
      {
        id: appt?.id,
        patientId: appt?.patientId,
        doctorId: appt?.doctorId,
        modality: appt?.modality,
        meetingUrl: appt?.meetingUrl,
        meetingRoomName: appt?.meetingRoomName,
        startAt: appt?.startAt,
        notes: appt?.notes?.slice(-500),
      },
      null,
      2,
    ),
  );

  const notes = await db
    .select({
      id: notificationsTable.id,
      userId: notificationsTable.userId,
      type: notificationsTable.type,
      title: notificationsTable.title,
      href: notificationsTable.href,
      referenceKey: notificationsTable.referenceKey,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(15);
  console.log("NOTIFS", JSON.stringify(notes, null, 2));

  const tokens = await db.select().from(pushTokensTable);
  console.log(
    "TOKENS",
    JSON.stringify(
      tokens.map((t) => ({
        id: t.id,
        userId: t.userId,
        platform: t.platform,
        updatedAt: t.updatedAt,
        token: `${t.token.slice(0, 22)}...`,
      })),
      null,
      2,
    ),
  );

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      roleId: usersTable.roleId,
      active: usersTable.active,
      firstName: usersTable.firstName,
      lastNamePaternal: usersTable.lastNamePaternal,
      phone: usersTable.phone,
      teleconsultaAvailable: usersTable.teleconsultaAvailable,
    })
    .from(usersTable);
  const roles = await db.select().from(rolesTable);
  const roleById = Object.fromEntries(roles.map((r) => [r.id, r.code]));
  console.log(
    "USERS",
    JSON.stringify(
      users.map((u) => ({ ...u, role: roleById[u.roleId] })),
      null,
      2,
    ),
  );

  const esc = await db
    .select()
    .from(teleconsultaEscalationsTable)
    .orderBy(desc(teleconsultaEscalationsTable.createdAt))
    .limit(5);
  console.log(
    "ESCALATIONS",
    JSON.stringify(
      esc.map((e) => ({
        id: e.id,
        appointmentId: e.appointmentId,
        status: e.status,
        indexInQueue: e.indexInQueue,
        queueJson: e.queueJson,
        createdAt: e.createdAt,
      })),
      null,
      2,
    ),
  );

  const attempts = await db
    .select()
    .from(teleconsultaAlertAttemptsTable)
    .orderBy(desc(teleconsultaAlertAttemptsTable.alertedAt))
    .limit(10);
  console.log(
    "ATTEMPTS",
    JSON.stringify(
      attempts.map((a) => ({
        id: a.id,
        escalationId: a.escalationId,
        doctorUserId: a.doctorUserId,
        status: a.status,
        error: a.errorDetail,
        channels: a.channels,
        voiceCallSid: a.voiceCallSid,
        smsSid: a.smsSid,
        createdAt: a.alertedAt,
      })),
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
