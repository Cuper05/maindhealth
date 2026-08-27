import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { patientsTable, stationKioskSessionsTable } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/email/send";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

/** Actualiza el correo del paciente vinculado a la sesión de estación. */
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
        { error: "Primero identifique al paciente o complete el alta." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json(
        { error: "Escriba un correo electrónico válido." },
        { status: 400 },
      );
    }

    await db
      .update(patientsTable)
      .set({ email, updatedAt: new Date() })
      .where(eq(patientsTable.id, session.patientId));

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("[station/patient-email]", error);
    return NextResponse.json({ error: "No se pudo guardar el correo" }, { status: 500 });
  }
}
