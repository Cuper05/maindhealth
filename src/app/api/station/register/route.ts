import { NextResponse } from "next/server";
import { registerKioskWalkIn } from "@/lib/kiosk/register";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await registerKioskWalkIn(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("station/register POST", error);
    const message = error instanceof Error ? error.message : "Error al registrar";
    // Colisión de expediente u otro error de BD → mensaje usable en kiosco.
    if (/unique|duplicate|chart_number/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "No se pudo crear el expediente (número duplicado). Intente de nuevo en unos segundos.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo completar el alta. Avise al personal de la estación." },
      { status: 500 },
    );
  }
}
