"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { notificationsTable } from "@/lib/db/schema";

export async function markNotificationRead(notificationId: number): Promise<void> {
  const session = await getActionSession("notifications:view");
  if ("error" in session) return;

  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, session.userId),
        isNull(notificationsTable.readAt),
      ),
    );

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function markAllNotificationsRead(_prev: unknown, _formData?: FormData) {
  const session = await getActionSession("notifications:view");
  if ("error" in session) return actionError(session.error);

  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, session.userId),
        isNull(notificationsTable.readAt),
      ),
    );

  revalidatePath("/notificaciones");
  revalidatePath("/");
  return actionSuccess({});
}
