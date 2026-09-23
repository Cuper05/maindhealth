import { NextResponse } from "next/server";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { saveKardiaFileToSession } from "@/lib/kiosk/save-kardia-file";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión de kiosko." }, { status: 400 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  return saveKardiaFileToSession(cookie.token, file);
}
