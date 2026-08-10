import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushTokensTable } from "@/lib/db/schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushPayload = {
  title: string;
  body: string;
  data: {
    appointmentId: number;
    meetingUrl: string | null;
    href: string;
  };
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Envía push a tokens Expo registrados para los userIds dados.
 * No lanza: errores se loguean; el flujo web de estación no debe romperse.
 */
export async function sendExpoPushToUsers(
  userIds: number[],
  payload: ExpoPushPayload,
): Promise<{ sent: number; failed: number }> {
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return { sent: 0, failed: 0 };

  const rows = await db
    .select({
      token: pushTokensTable.token,
      id: pushTokensTable.id,
    })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, uniqueIds));

  if (rows.length === 0) return { sent: 0, failed: 0 };

  const messages = rows.map((row) => ({
    to: row.token,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    priority: "high" as const,
    channelId: "teleconsulta",
    // iOS: interrupt / alert style
    interruptionLevel: "timeSensitive" as const,
    ttl: 60 * 60,
  }));

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  // Expo accepts batches up to 100
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        console.error("[expo-push] HTTP", res.status, await res.text().catch(() => ""));
        failed += batch.length;
        continue;
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      for (let t = 0; t < tickets.length; t++) {
        const ticket = tickets[t];
        if (ticket?.status === "ok") {
          sent += 1;
        } else {
          failed += 1;
          const err = ticket?.details?.error;
          if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
            invalidTokens.push(batch[t].to);
          }
          console.warn("[expo-push] ticket error", ticket?.message ?? err, batch[t].to.slice(0, 24));
        }
      }
    } catch (err) {
      console.error("[expo-push] send failed", err);
      failed += batch.length;
    }
  }

  if (invalidTokens.length > 0) {
    try {
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, invalidTokens));
    } catch (err) {
      console.error("[expo-push] cleanup invalid tokens", err);
    }
  }

  return { sent, failed };
}
