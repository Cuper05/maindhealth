import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export interface KioskCookieData {
  token?: string;
}

export const kioskCookieOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "dev_only_session_secret_change_in_production_32chars",
  cookieName: "maindhealth_kiosk",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  },
};

export async function getKioskCookie() {
  return getIronSession<KioskCookieData>(await cookies(), kioskCookieOptions);
}

export function newKioskToken() {
  return randomBytes(24).toString("hex");
}
