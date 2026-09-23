import { NextResponse } from "next/server";
import { saveKardiaFileToSession } from "@/lib/kiosk/save-kardia-file";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 400 });
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
  return saveKardiaFileToSession(token, file);
}
