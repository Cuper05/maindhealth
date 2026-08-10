import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/audit/log-activity";
import { signMobileToken } from "@/lib/auth/mobile-token";
import type { UserRole } from "@/lib/constants";
import { db } from "@/lib/db";
import { rolesTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** CORS helper for Expo / React Native fetch. */
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
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    }

    const email = parsed.data.email.toLowerCase();
    const [row] = await db
      .select({
        id: usersTable.id,
        patientId: usersTable.patientId,
        firstName: usersTable.firstName,
        lastNamePaternal: usersTable.lastNamePaternal,
        lastNameMaternal: usersTable.lastNameMaternal,
        passwordHash: usersTable.passwordHash,
        active: usersTable.active,
        roleCode: rolesTable.code,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.email, email));

    if (!row?.active) {
      return withCors(
        NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 }),
      );
    }

    const role = row.roleCode as UserRole;
    if (role !== "doctor" && role !== "admin") {
      return withCors(
        NextResponse.json(
          { error: "Esta app es solo para médicos. Usa el portal web." },
          { status: 403 },
        ),
      );
    }

    const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
    if (!ok) {
      return withCors(
        NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 }),
      );
    }

    const name = formatPersonName(row);
    const token = signMobileToken({ userId: row.id, name, role });

    await logActivity({
      userId: row.id,
      module: "auth",
      action: "login",
      detail: `mobile:${email}`,
    });

    return withCors(
      NextResponse.json({
        ok: true,
        token,
        user: { id: row.id, name, role, email },
      }),
    );
  } catch (err) {
    console.error("[mobile/login]", err);
    return withCors(
      NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 }),
    );
  }
}
