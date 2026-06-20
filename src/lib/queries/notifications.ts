import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationsTable } from "@/lib/db/schema";

export async function getUnreadNotificationCount(userId: number) {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)),
    );
  return row?.total ?? 0;
}

export async function getUserNotifications(userId: number, limit = 100) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}
