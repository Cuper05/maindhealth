import { NextResponse } from "next/server";
import { resendAttemptLinkMessages } from "@/lib/alerts/teleconsulta-escalate";

export const runtime = "nodejs";

function twimlSay(message: string) {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="alice">${escaped}</Say>
  <Hangup/>
</Response>`;
}

/** Twilio Gather callback — digit 1 resends SMS + WhatsApp join link. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const attemptId = Number(url.searchParams.get("attemptId"));

  let digits = "";
  try {
    const form = await request.formData();
    digits = String(form.get("Digits") ?? "");
  } catch {
    digits = url.searchParams.get("Digits") ?? "";
  }

  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    return new NextResponse(twimlSay("Error de enlace. Revise SMS."), {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  if (digits.trim() === "1") {
    const result = await resendAttemptLinkMessages(attemptId);
    if (result.ok) {
      return new NextResponse(
        twimlSay("Listo. Le reenviamos el enlace por SMS y WhatsApp. Abra el mensaje."),
        { headers: { "Content-Type": "text/xml; charset=utf-8" } },
      );
    }
    return new NextResponse(
      twimlSay("No pudimos reenviar. Revise el mensaje que ya recibió."),
      { headers: { "Content-Type": "text/xml; charset=utf-8" } },
    );
  }

  return new NextResponse(twimlSay("Revise SMS o WhatsApp. Gracias."), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
