import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/mobile-token";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  notificationsTable,
  stationKioskSessionsTable,
} from "@/lib/db/schema";
import type {
  KioskAssessmentDraft,
  KioskVitalsDraft,
} from "@/lib/db/schema/station-kiosk";

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
 * Incluye resumen clínico del kiosco + meetingUrl real de la cita (para Daily).
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

    const appointmentIds = [
      ...new Set(
        rows
          .map((row) => parseAppointmentId(row.referenceKey, row.href))
          .filter((id): id is number => id != null),
      ),
    ];

    const kioskByAppointment = new Map<
      number,
      {
        clinicalDraft: Record<string, unknown>;
        vitalsDraft: KioskVitalsDraft | null;
        assessmentDraft: KioskAssessmentDraft | null;
        paymentStatus: string | null;
      }
    >();
    const meetingByAppointment = new Map<number, string | null>();

    if (appointmentIds.length > 0) {
      const [sessions, appointments] = await Promise.all([
        db
          .select({
            appointmentId: stationKioskSessionsTable.appointmentId,
            clinicalDraft: stationKioskSessionsTable.clinicalDraft,
            vitalsDraft: stationKioskSessionsTable.vitalsDraft,
            assessmentDraft: stationKioskSessionsTable.assessmentDraft,
            paymentStatus: stationKioskSessionsTable.paymentStatus,
            updatedAt: stationKioskSessionsTable.updatedAt,
          })
          .from(stationKioskSessionsTable)
          .where(inArray(stationKioskSessionsTable.appointmentId, appointmentIds))
          .orderBy(desc(stationKioskSessionsTable.updatedAt)),
        db
          .select({
            id: appointmentsTable.id,
            meetingUrl: appointmentsTable.meetingUrl,
          })
          .from(appointmentsTable)
          .where(inArray(appointmentsTable.id, appointmentIds)),
      ]);

      for (const s of sessions) {
        if (s.appointmentId == null || kioskByAppointment.has(s.appointmentId)) continue;
        kioskByAppointment.set(s.appointmentId, {
          clinicalDraft: (s.clinicalDraft ?? {}) as Record<string, unknown>,
          vitalsDraft: (s.vitalsDraft ?? null) as KioskVitalsDraft | null,
          assessmentDraft: (s.assessmentDraft ?? null) as KioskAssessmentDraft | null,
          paymentStatus: s.paymentStatus,
        });
      }
      for (const a of appointments) {
        meetingByAppointment.set(a.id, a.meetingUrl);
      }
    }

    const items = rows.map((row) => {
      const appointmentId = parseAppointmentId(row.referenceKey, row.href);
      const fromHref =
        row.href && /^https?:\/\//i.test(row.href) ? row.href : null;
      const meetingUrl =
        (appointmentId ? meetingByAppointment.get(appointmentId) : null) ||
        fromHref ||
        null;
      const kiosk = appointmentId ? kioskByAppointment.get(appointmentId) : undefined;
      const clinicalSummary = buildClinicalSummary(kiosk);
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
        clinicalSummary,
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

function buildClinicalSummary(
  kiosk:
    | {
        clinicalDraft: Record<string, unknown>;
        vitalsDraft: KioskVitalsDraft | null;
        assessmentDraft: KioskAssessmentDraft | null;
        paymentStatus: string | null;
      }
    | undefined,
) {
  if (!kiosk) {
    return {
      crisis: false,
      chiefComplaint: null as string | null,
      vitalsLine: null as string | null,
      redFlags: [] as string[],
      diagnosis: null as string | null,
      severity: null as string | null,
      summary: null as string | null,
      paymentStatus: null as string | null,
    };
  }

  const clinical = kiosk.clinicalDraft;
  const chief =
    typeof clinical.chiefComplaint === "string" && clinical.chiefComplaint.trim()
      ? clinical.chiefComplaint.trim()
      : null;
  const crisis = clinical.crisisMode === true || clinical.crisisIntent === true;
  const v = kiosk.vitalsDraft;
  const vitalsParts: string[] = [];
  if (v) {
    if (v.systolicPressure || v.diastolicPressure) {
      vitalsParts.push(`PA ${v.systolicPressure ?? "—"}/${v.diastolicPressure ?? "—"}`);
    }
    if (v.heartRate) vitalsParts.push(`FC ${v.heartRate}`);
    if (v.oxygenSaturation) vitalsParts.push(`SpO₂ ${v.oxygenSaturation}%`);
    if (v.temperature) vitalsParts.push(`Temp ${v.temperature}°C`);
    if (v.weight) vitalsParts.push(`Peso ${v.weight} kg`);
  }
  const a = kiosk.assessmentDraft;

  return {
    crisis,
    chiefComplaint: chief,
    vitalsLine: vitalsParts.length > 0 ? vitalsParts.join(" · ") : null,
    redFlags: a?.redFlags ?? [],
    diagnosis: a?.diagnosis ?? null,
    severity: a?.severity ?? null,
    summary: a?.summary ?? null,
    paymentStatus: kiosk.paymentStatus,
  };
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
