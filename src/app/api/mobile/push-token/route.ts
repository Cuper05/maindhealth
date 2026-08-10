import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileAuth } from "@/lib/auth/mobile-token";
import { db } from "@/lib/db";
import { PUSH_PLATFORMS, pushTokensTable } from "@/lib/db/schema";

const registerSchema = z.object({
  token: z.string().min(10).max(255),
  platform: z.enum(PUSH_PLATFORMS).default("android"),
  action: z.enum(["register", "unregister"]).default("register"),
});

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const auth = requireMobileAuth(request);
  if (!auth) {
    return withCors(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    }

    const { token, platform, action } = parsed.data;

    if (action === "unregister") {
      await db
        .delete(pushTokensTable)
        .where(and(eq(pushTokensTable.token, token), eq(pushTokensTable.userId, auth.userId)));
      return withCors(NextResponse.json({ ok: true, action: "unregistered" }));
    }

    const [existing] = await db
      .select({ id: pushTokensTable.id, userId: pushTokensTable.userId })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.token, token));

    if (existing) {
      await db
        .update(pushTokensTable)
        .set({
          userId: auth.userId,
          platform,
          updatedAt: new Date(),
        })
        .where(eq(pushTokensTable.id, existing.id));
    } else {
      await db.insert(pushTokensTable).values({
        userId: auth.userId,
        token,
        platform,
      });
    }

    return withCors(NextResponse.json({ ok: true, action: "registered" }));
  } catch (err) {
    console.error("[mobile/push-token]", err);
    return withCors(NextResponse.json({ error: "Error al registrar token" }, { status: 500 }));
  }
}
