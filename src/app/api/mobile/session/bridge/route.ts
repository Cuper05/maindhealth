import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { verifyMobileToken } from "@/lib/auth/mobile-token";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import type { UserRole } from "@/lib/constants";

/**
 * Puente app móvil → sesión web (cookie).
 * El WebView navega aquí con el JWT; se crea maindhealth_session y redirige a la consulta
 * para que el médico pueda guardar nota y emitir receta.
 *
 * GET /api/mobile/session/bridge?token=…&appointmentId=123
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim() || "";
    const appointmentId = Number(url.searchParams.get("appointmentId"));
    const auth = verifyMobileToken(token);

    if (!auth) {
      return NextResponse.redirect(new URL("/login?from=/consultas", request.url));
    }

    if (auth.role !== "doctor" && auth.role !== "admin") {
      return NextResponse.json({ error: "Solo médicos" }, { status: 403 });
    }

    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return NextResponse.json({ error: "Cita inválida" }, { status: 400 });
    }

    const dest = new URL(`/consultas/cita/${appointmentId}`, request.url);
    dest.searchParams.set("focus", "receta");
    const response = NextResponse.redirect(dest);

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = auth.userId;
    session.name = auth.name;
    session.role = auth.role as UserRole;
    session.isLoggedIn = true;
    await session.save();

    return response;
  } catch (err) {
    console.error("[mobile/session/bridge]", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
