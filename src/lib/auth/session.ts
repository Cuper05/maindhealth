import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/constants";

export interface SessionData {
  userId?: number;
  patientId?: number;
  name?: string;
  role?: UserRole;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "dev_only_session_secret_change_in_production_32chars",
  cookieName: "maindhealth_session",
  /** 30 días: la Dell de estación no pide login en cada reinicio. */
  ttl: 60 * 60 * 24 * 30,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return null;
  return session;
}
