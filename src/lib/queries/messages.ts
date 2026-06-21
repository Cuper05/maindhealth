import { desc, eq, isNull, sql } from "drizzle-orm";
import { resolvePatientId } from "@/lib/auth/patient-scope";
import type { UserRole } from "@/lib/constants";
import { db } from "@/lib/db";
import { clinicalMessagesTable, patientsTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function markMessagesReadForUser(
  patientId: number,
  session: { userId: number; role: UserRole },
) {
  if (session.role === "patient") {
    const ownPatientId = await resolvePatientId({
      userId: session.userId,
      role: session.role,
      isLoggedIn: true,
    });
    if (ownPatientId !== patientId) {
      throw new Error("Sin permiso");
    }
    await db
      .update(clinicalMessagesTable)
      .set({ readByPatientAt: new Date() })
      .where(eq(clinicalMessagesTable.patientId, patientId));
    return;
  }

  await db
    .update(clinicalMessagesTable)
    .set({ readByStaffAt: new Date() })
    .where(eq(clinicalMessagesTable.patientId, patientId));
}

export async function getPatientMessages(patientId: number) {
  return db
    .select({
      id: clinicalMessagesTable.id,
      body: clinicalMessagesTable.body,
      senderRole: clinicalMessagesTable.senderRole,
      createdAt: clinicalMessagesTable.createdAt,
      readByPatientAt: clinicalMessagesTable.readByPatientAt,
      readByStaffAt: clinicalMessagesTable.readByStaffAt,
      senderFirstName: usersTable.firstName,
      senderLastNamePaternal: usersTable.lastNamePaternal,
      senderLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(clinicalMessagesTable)
    .innerJoin(usersTable, eq(clinicalMessagesTable.senderUserId, usersTable.id))
    .where(eq(clinicalMessagesTable.patientId, patientId))
    .orderBy(clinicalMessagesTable.createdAt);
}

export function formatMessageSender(row: {
  senderFirstName: string;
  senderLastNamePaternal: string;
  senderLastNameMaternal?: string | null;
  senderRole: string;
}) {
  const name = formatPersonName({
    firstName: row.senderFirstName,
    lastNamePaternal: row.senderLastNamePaternal,
    lastNameMaternal: row.senderLastNameMaternal,
  });
  return row.senderRole === "patient" ? name : `${name} (${row.senderRole})`;
}

export async function getUnreadMessageCountForStaff() {
  const rows = await db
    .select({ id: clinicalMessagesTable.id })
    .from(clinicalMessagesTable)
    .where(isNull(clinicalMessagesTable.readByStaffAt));
  return rows.length;
}

export async function getMessageThreadsForStaff() {
  const rows = await db
    .select({
      patientId: clinicalMessagesTable.patientId,
      lastMessageAt: sql<Date>`max(${clinicalMessagesTable.createdAt})`.as("last_message_at"),
      unreadCount: sql<number>`count(*) filter (where ${clinicalMessagesTable.readByStaffAt} is null)`.as(
        "unread_count",
      ),
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(clinicalMessagesTable)
    .innerJoin(patientsTable, eq(clinicalMessagesTable.patientId, patientsTable.id))
    .groupBy(
      clinicalMessagesTable.patientId,
      patientsTable.chartNumber,
      patientsTable.firstName,
      patientsTable.lastNamePaternal,
      patientsTable.lastNameMaternal,
    )
    .orderBy(desc(sql`max(${clinicalMessagesTable.createdAt})`));

  return rows.map((row) => ({
    ...row,
    patientName: formatPersonName({
      firstName: row.patientFirstName,
      lastNamePaternal: row.patientLastNamePaternal,
      lastNameMaternal: row.patientLastNameMaternal,
    }),
  }));
}
