import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/audit/log-activity";
import { getSession } from "@/lib/auth/session";
import type { UserRole } from "@/lib/constants";
import { db } from "@/lib/db";
import { rolesTable, usersTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const [row] = await db
      .select({
        id: usersTable.id,
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
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 },
      );
    }

    const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 },
      );
    }

    const name = formatPersonName(row);
    const role = row.roleCode as UserRole;

    const session = await getSession();
    session.userId = row.id;
    session.name = name;
    session.role = role;
    session.isLoggedIn = true;
    await session.save();

    await logActivity({
      userId: row.id,
      module: "auth",
      action: "login",
      detail: email,
    });

    return NextResponse.json({
      ok: true,
      user: { id: row.id, name, role },
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      { error: "Error al iniciar sesión. Revisa DATABASE_URL y db:seed." },
      { status: 500 },
    );
  }
}
