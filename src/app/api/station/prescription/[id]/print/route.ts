import { NextResponse } from "next/server";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { loadStationPrescription } from "@/lib/kiosk/station-prescription";
import { buildPrescriptionPrintHtml } from "@/lib/pdf/prescription-print-html";

/** HTML imprimible para kiosko — evita el visor PDF y el diálogo "Guardar". */
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

    const loaded = await loadStationPrescription(cookie.token, prescriptionId);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const html = await buildPrescriptionPrintHtml(loaded.data);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[station/prescription/print]", error);
    return NextResponse.json(
      { error: "No se pudo generar la receta para imprimir" },
      { status: 500 },
    );
  }
}
