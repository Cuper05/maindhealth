import bcrypt from "bcryptjs";
import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { patientsTable } from "@/lib/db/schema";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { startWalkInForExistingPatient } from "@/lib/kiosk/walk-in";
import { formatPersonName } from "@/lib/format/name";

export async function POST(request: Request) {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 401 });
    }

    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!username || password.length < 4) {
      return NextResponse.json(
        { error: "Escriba su usuario y contraseña (mínimo 4 caracteres)." },
        { status: 400 },
      );
    }

    const [row] = await db
      .select()
      .from(patientsTable)
      .where(
        and(eq(patientsTable.kioskUsername, username), isNotNull(patientsTable.kioskPasswordHash)),
      );

    if (!row?.kioskPasswordHash) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, row.kioskPasswordHash);
    if (!ok) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    const visit = await startWalkInForExistingPatient(row.id);
    if (!visit.ok) {
      return NextResponse.json({ error: visit.error }, { status: 400 });
    }

    return NextResponse.json({
      ...visit,
      patient: {
        id: row.id,
        chartNumber: row.chartNumber,
        name: formatPersonName(row),
        birthDate: row.birthDate,
        sex: row.sex,
        phone: row.phone,
        email: row.email,
        hasKioskLogin: true,
      },
      antecedents: row.kioskAntecedents ?? null,
    });
  } catch (error) {
    console.error("[station/login]", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
