import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { requireMobileAuth } from "@/lib/auth/mobile-token";
import { requireSession } from "@/lib/auth/session";
import { getKioskSessionByAppointment } from "@/lib/queries/kiosk-session";

export const runtime = "nodejs";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  const web = await requireSession();
  const mobile = requireMobileAuth(request);
  const allowed =
    (web?.role && can(web.role, "patients:view")) || Boolean(mobile);
  if (!allowed) {
    return withCors(NextResponse.json({ error: "Sin permiso" }, { status: 403 }));
  }

  const appointmentId = Number(new URL(request.url).searchParams.get("appointmentId"));
  if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
    return withCors(NextResponse.json({ error: "Cita inválida" }, { status: 400 }));
  }

  const session = await getKioskSessionByAppointment(appointmentId, { includeKardiaFile: true });
  const mime = session?.vitalsDraft?.ecgKardiaMime;
  const data = session?.vitalsDraft?.ecgKardiaData;
  const name = session?.vitalsDraft?.ecgKardiaFileName || "kardia-ecg.pdf";
  if (!mime || !data) {
    return withCors(NextResponse.json({ error: "No hay ECG de Kardia en esta visita." }, { status: 404 }));
  }

  const buffer = Buffer.from(data, "base64");
  return withCors(
    new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    }),
  );
}
