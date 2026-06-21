import { eq } from "drizzle-orm";
import type { SessionData } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { usersTable } from "@/lib/db/schema";

export async function resolvePatientId(session: SessionData): Promise<number | null> {
  if (session.patientId) return session.patientId;
  if (!session.userId) return null;

  const [user] = await db
    .select({ patientId: usersTable.patientId })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  return user?.patientId ?? null;
}

export async function requirePatientId(session: SessionData): Promise<number | null> {
  if (session.role !== "patient") return null;
  return resolvePatientId(session);
}
