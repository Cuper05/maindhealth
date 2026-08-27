import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { patientsTable, stationKioskSessionsTable } from "@/lib/db/schema";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

/**
 * Crea o actualiza usuario/contraseña del paciente ya vinculado a la sesión de estación.
 * Para pacientes con expediente previo que aún no tenían perfil de kiosko.
 */
export async function POST(request: Request) {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 401 });
    }

    const [session] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.token, cookie.token));

    if (!session?.patientId) {
      return NextResponse.json(
        { error: "Primero busque su expediente o complete el alta." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: "Elija un usuario de al menos 3 caracteres." },
        { status: 400 },
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 4 caracteres." },
        { status: 400 },
      );
    }

    const [taken] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.kioskUsername, username));

    if (taken && taken.id !== session.patientId) {
      return NextResponse.json(
        { error: "Ese usuario ya está en uso. Elija otro nombre." },
        { status: 409 },
      );
    }

    const hash = await bcrypt.hash(password, 10);
    await db
      .update(patientsTable)
      .set({
        kioskUsername: username,
        kioskPasswordHash: hash,
        updatedAt: new Date(),
      })
      .where(eq(patientsTable.id, session.patientId));

    return NextResponse.json({ ok: true, username });
  } catch (error) {
    console.error("[station/profile]", error);
    return NextResponse.json({ error: "No se pudo guardar el perfil" }, { status: 500 });
  }
}
