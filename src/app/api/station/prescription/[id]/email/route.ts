import { NextResponse } from "next/server";
import { emailStationPrescription } from "@/lib/kiosk/send-prescription-email";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 401 });
    }

    const { id } = await context.params;
    const prescriptionId = Number(id);
    if (!Number.isFinite(prescriptionId)) {
      return NextResponse.json({ error: "Receta inválida" }, { status: 400 });
    }

    const result = await emailStationPrescription(cookie.token, prescriptionId);
    if (!result.ok) {
      const status = result.skipped ? 503 : 400;
      return NextResponse.json({ error: result.error, skipped: result.skipped === true }, { status });
    }

    return NextResponse.json({
      ok: true,
      email: result.email,
      alreadySent: result.alreadySent,
    });
  } catch (error) {
    console.error("[station/prescription/email]", error);
    return NextResponse.json({ error: "No se pudo enviar la receta por correo" }, { status: 500 });
  }
}
