import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/mobile-token";
import { db } from "@/lib/db";
import { notificationsTable } from "@/lib/db/schema";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * Lista notificaciones de teleconsulta (estación) pendientes / recientes.
 */
export async function GET(request: Request) {
  const auth = requireMobileAuth(request);
  if (!auth) {
    return withCors(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
  }

  try {
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const conditions = [
      eq(notificationsTable.userId, auth.userId),
      eq(notificationsTable.type, "videollamada_lista"),
    ];
    if (unreadOnly) conditions.push(isNull(notificationsTable.readAt));

    const rows = await db
      .select({
        id: notificationsTable.id,
        type: notificationsTable.type,
        title: notificationsTable.title,
        body: notificationsTable.body,
        href: notificationsTable.href,
        referenceKey: notificationsTable.referenceKey,
        readAt: notificationsTable.readAt,
        createdAt: notificationsTable.createdAt,
      })
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    const items = rows.map((row) => {
      const appointmentId = parseAppointmentId(row.referenceKey, row.href);
      const meetingUrl =
        row.href && /^https?:\/\//i.test(row.href) ? row.href : null;
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        href: row.href,
        meetingUrl,
        appointmentId,
        readAt: row.readAt,
        createdAt: row.createdAt,
        unread: !row.readAt,
      };
    });

    return withCors(
      NextResponse.json({
        ok: true,
        user: { id: auth.userId, name: auth.name, role: auth.role },
        items,
      }),
    );
  } catch (err) {
    console.error("[mobile/teleconsultas]", err);
    return withCors(NextResponse.json({ error: "Error al listar" }, { status: 500 }));
  }
}

function parseAppointmentId(
  referenceKey: string | null,
  href: string | null,
): number | null {
  if (referenceKey?.startsWith("estacion-teleconsulta:")) {
    const n = Number(referenceKey.split(":")[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const m = href?.match(/\/consultas\/cita\/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
