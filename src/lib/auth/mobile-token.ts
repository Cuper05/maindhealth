import { createHmac, timingSafeEqual } from "crypto";
import type { UserRole } from "@/lib/constants";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PREFIX = "mh1";

export type MobileTokenPayload = {
  userId: number;
  name: string;
  role: UserRole;
  exp: number;
};

function secret() {
  return (
    process.env.SESSION_SECRET ??
    "dev_only_session_secret_change_in_production_32chars"
  );
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function signMobileToken(input: {
  userId: number;
  name: string;
  role: UserRole;
}): string {
  const payload: MobileTokenPayload = {
    userId: input.userId,
    name: input.name,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret()).update(`${PREFIX}.${body}`).digest());
  return `${PREFIX}.${body}.${sig}`;
}

export function verifyMobileToken(token: string | null | undefined): MobileTokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, body, sig] = parts;
  const expected = b64url(createHmac("sha256", secret()).update(`${PREFIX}.${body}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as MobileTokenPayload;
    if (!payload?.userId || !payload.role || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function requireMobileAuth(request: Request): MobileTokenPayload | null {
  return verifyMobileToken(bearerFromRequest(request));
}
