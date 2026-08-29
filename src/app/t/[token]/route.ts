import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  rolesTable,
  teleconsultaJoinTokensTable,
  usersTable,
} from "@/lib/db/schema";
import { markTeleconsultaJoined } from "@/lib/alerts/teleconsulta-escalate";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import type { UserRole } from "@/lib/constants";
import { formatPersonName } from "@/lib/format/name";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Enlace público (SMS/WhatsApp): autentica al médico (cookie en Route Handler)
 * y redirige a la consulta completa. No usar page.tsx — Next 16 bloquea
 * cookies().set fuera de Server Actions / Route Handlers.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await context.params;
    const token = rawToken?.trim();
    if (!token) {
      return joinError(400, "Enlace inválido", "Falta el token de acceso.");
    }

    const [row] = await db
      .select({
        id: teleconsultaJoinTokensTable.id,
        appointmentId: teleconsultaJoinTokensTable.appointmentId,
        userId: teleconsultaJoinTokensTable.userId,
        expiresAt: teleconsultaJoinTokensTable.expiresAt,
        usedAt: teleconsultaJoinTokensTable.usedAt,
        revokedAt: teleconsultaJoinTokensTable.revokedAt,
      })
      .from(teleconsultaJoinTokensTable)
      .where(eq(teleconsultaJoinTokensTable.token, token));

    if (!row) {
      return joinError(404, "Enlace no válido", "Este enlace no existe o ya expiró.");
    }

    if (row.revokedAt) {
      return joinError(
        410,
        "Enlace cancelado",
        "Otro médico ya atendió esta teleconsulta, o el enlace fue revocado.",
      );
    }

    if (row.expiresAt.getTime() < Date.now()) {
      return joinError(
        410,
        "Enlace expirado",
        "Solicite un nuevo aviso desde la estación o contacte a MaindHealth.",
      );
    }

    const [appointment] = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, row.appointmentId));

    if (!appointment) {
      return joinError(404, "Cita no encontrada", "No hay teleconsulta asociada a este enlace.");
    }

    if (!row.userId) {
      return joinError(
        400,
        "Médico no asignado",
        "Este enlace no tiene médico. Entre a MaindHealth e inicie sesión.",
      );
    }

    const [doctor] = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastNamePaternal: usersTable.lastNamePaternal,
        lastNameMaternal: usersTable.lastNameMaternal,
        patientId: usersTable.patientId,
        active: usersTable.active,
        roleCode: rolesTable.code,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.id, row.userId));

    if (!doctor?.active) {
      return joinError(403, "Cuenta inactiva", "El usuario médico de este enlace no está activo.");
    }

    if (!row.usedAt) {
      await db
        .update(teleconsultaJoinTokensTable)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(teleconsultaJoinTokensTable.id, row.id),
            isNull(teleconsultaJoinTokensTable.usedAt),
          ),
        );
    }

    try {
      await markTeleconsultaJoined({
        appointmentId: appointment.id,
        doctorUserId: row.userId,
        joinTokenId: row.id,
      });
    } catch (err) {
      console.error("[t/token] markTeleconsultaJoined", err);
    }

    // Cookie write is allowed here (Route Handler).
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = doctor.id;
    session.patientId = doctor.patientId ?? undefined;
    session.name = formatPersonName(doctor);
    session.role = doctor.roleCode as UserRole;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.redirect(
      new URL(`/consultas/cita/${appointment.id}?focus=video`, _request.url),
      303,
    );
  } catch (err) {
    console.error("[t/token]", err);
    return joinError(
      500,
      "No se pudo abrir la teleconsulta",
      "Hubo un error del servidor. Entre a MaindHealth con su usuario o pida un nuevo enlace.",
    );
  }
}

function joinError(status: number, title: string, body: string) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · MaindHealth</title>
  <style>
    body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:#020617;color:#fff;font-family:system-ui,sans-serif;padding:1.5rem;text-align:center}
    .logo{width:min(220px,80vw);height:auto;background:#fff;border-radius:1rem;padding:.75rem 1rem}
    h1{margin:1rem 0 0;font-size:1.25rem;font-weight:600}
    p{margin:.5rem 0 0;max-width:24rem;font-size:.875rem;color:#cbd5e1}
    a{margin-top:1.5rem;display:inline-block;border-radius:.5rem;background:#0d9488;color:#fff;
      padding:.65rem 1.25rem;font-size:.875rem;font-weight:600;text-decoration:none}
  </style>
</head>
<body>
  <img class="logo" src="/brand/maindhealth-logo.png" alt="MaindHealth" width="220" height="140" />
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
  <a href="/login">Iniciar sesión</a>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
