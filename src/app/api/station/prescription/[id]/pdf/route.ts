import { NextResponse } from "next/server";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { buildStationPrescriptionPdf } from "@/lib/kiosk/station-prescription";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 401 });
    }

    const { id } = await params;
    const prescriptionId = Number(id);
    if (!Number.isFinite(prescriptionId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const result = await buildStationPrescriptionPdf(cookie.token, prescriptionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[station/prescription/pdf]", error);
    const message =
      error instanceof Error && error.message.includes("ENOENT")
        ? "No se pudo generar el PDF (recursos del servidor). Intenta de nuevo."
        : "No se pudo generar el PDF de la receta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
