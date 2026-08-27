import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stationKioskSessionsTable, type KioskAssessmentDraft } from "@/lib/db/schema";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

/**
 * Confirma que la estación imprimió (o falló) la receta firmada por el médico.
 * Auth: sesión staff (Dell) o cookie de kiosk.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      appointmentId?: number;
      prescriptionId?: number;
      ok?: boolean;
      error?: string;
    };
    const appointmentId = Number(body.appointmentId);
    const prescriptionId = Number(body.prescriptionId);
    if (!Number.isFinite(appointmentId) || !Number.isFinite(prescriptionId)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const staff = await requireSession();
    const staffOk = staff && can(staff.role, "intake:view");
    const kiosk = await getKioskCookie();
    if (!staffOk && !kiosk.token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.appointmentId, appointmentId))
      .orderBy(desc(stationKioskSessionsTable.updatedAt))
      .limit(1);

    if (!row) {
      return NextResponse.json({ ok: true, found: false });
    }

    if (kiosk.token && row.token !== kiosk.token && !staffOk) {
      return NextResponse.json({ error: "Sesión de estación no coincide" }, { status: 403 });
    }

    const draft: KioskAssessmentDraft = {
      ...((row.assessmentDraft ?? {}) as KioskAssessmentDraft),
      prescriptionId,
      printPending: false,
      printCompletedAt: body.ok ? new Date().toISOString() : null,
      printError: body.ok ? null : body.error || "Error de impresión",
    };

    await db
      .update(stationKioskSessionsTable)
      .set({ assessmentDraft: draft, updatedAt: new Date() })
      .where(eq(stationKioskSessionsTable.id, row.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[station/print-ack]", error);
    return NextResponse.json({ error: "No se pudo confirmar impresión" }, { status: 500 });
  }
}
