import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stationKioskSessionsTable } from "@/lib/db/schema";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

/**
 * Estado de la sesión de kiosco ligada a la cita (backup para que la Dell vuelva a standby).
 */
export async function GET(request: Request) {
  try {
    const appointmentId = Number(new URL(request.url).searchParams.get("appointmentId"));
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return NextResponse.json({ error: "appointmentId inválido" }, { status: 400 });
    }

    const staff = await requireSession();
    const staffOk = Boolean(staff && can(staff.role, "intake:view"));
    const kiosk = await getKioskCookie();
    if (!staffOk && !kiosk.token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const [row] = await db
      .select({
        token: stationKioskSessionsTable.token,
        status: stationKioskSessionsTable.status,
        deviceStatus: stationKioskSessionsTable.deviceStatus,
        assessmentDraft: stationKioskSessionsTable.assessmentDraft,
      })
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

    const draft =
      row.assessmentDraft && typeof row.assessmentDraft === "object"
        ? (row.assessmentDraft as Record<string, unknown>)
        : {};

    return NextResponse.json({
      ok: true,
      found: true,
      status: row.status,
      deviceStatus: row.deviceStatus,
      printPending: draft.printPending === true,
      prescriptionId:
        typeof draft.prescriptionId === "number" ? draft.prescriptionId : null,
      callEnded:
        row.status !== "waiting_doctor" &&
        (row.status === "completed" ||
          row.deviceStatus === "call_ended" ||
          draft.callEnded === true),
    });
  } catch (error) {
    console.error("[station/video-opened GET]", error);
    return NextResponse.json({ error: "No se pudo consultar estado" }, { status: 500 });
  }
}

/**
 * Eventos de la PC Dell (sala de video) hacia el kiosko táctil.
 * - sala_opened: video listo (no silencia calma de crisis)
 * - doctor_joined: el médico ya entró a la llamada → silenciar calma
 * - call_ended: teleconsulta terminó → kiosko vuelve a bienvenida
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session || !can(session.role, "intake:view")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as {
      appointmentId?: number;
      event?: "sala_opened" | "doctor_joined" | "call_ended";
    };
    const appointmentId = Number(body.appointmentId);
    const event =
      body.event === "doctor_joined"
        ? "doctor_joined"
        : body.event === "call_ended"
          ? "call_ended"
          : "sala_opened";
    if (!Number.isFinite(appointmentId)) {
      return NextResponse.json({ error: "appointmentId inválido" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.appointmentId, appointmentId));

    for (const row of rows) {
      const draft =
        row.assessmentDraft && typeof row.assessmentDraft === "object"
          ? { ...(row.assessmentDraft as Record<string, unknown>) }
          : {};

      if (event === "doctor_joined") {
        draft.doctorPresent = true;
        draft.doctorPresentAt = new Date().toISOString();
      } else if (event === "call_ended") {
        draft.callEnded = true;
        draft.callEndedAt = new Date().toISOString();
      } else {
        draft.videoOpened = true;
        draft.videoOpenedAt = new Date().toISOString();
      }

      const deviceStatus =
        event === "doctor_joined"
          ? "doctor_live"
          : event === "call_ended"
            ? "call_ended"
            : "video_ready";

      await db
        .update(stationKioskSessionsTable)
        .set({
          assessmentDraft: draft as typeof row.assessmentDraft,
          deviceStatus,
          ...(event === "call_ended"
            ? { status: "completed", currentStep: "welcome" }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(stationKioskSessionsTable.id, row.id));
    }

    return NextResponse.json({ ok: true, updated: rows.length, event });
  } catch (error) {
    console.error("[station/video-opened]", error);
    return NextResponse.json({ error: "No se pudo registrar evento de video" }, { status: 500 });
  }
}
