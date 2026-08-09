import { NextResponse } from "next/server";
import { completeKioskVisit } from "@/lib/kiosk/complete-visit";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

export async function POST() {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 400 });
    }

    const result = await completeKioskVisit(cookie.token);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("station/assess POST", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar el análisis. Intenta de nuevo.",
      },
      { status: 500 },
    );
  }
}
