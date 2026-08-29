import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/alerts/twilio";
import { getAttemptForVoice } from "@/lib/alerts/teleconsulta-escalate";

export const runtime = "nodejs";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Twilio Voice webhook — TwiML urgency message + Gather (press 1 to resend link).
 * Public (Twilio servers call this).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const attemptId = Number(url.searchParams.get("attemptId"));
  const doctor = url.searchParams.get("doctor") || "Doctor";
  const patient = url.searchParams.get("patient") || "un paciente";

  if (Number.isFinite(attemptId) && attemptId > 0) {
    const attempt = await getAttemptForVoice(attemptId);
    if (attempt?.status === "joined") {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="alice">La teleconsulta ya fue atendida. Gracias.</Say>
  <Hangup/>
</Response>`;
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      });
    }
  }

  const gatherAction = `${appBaseUrl()}/api/alerts/twilio/gather?attemptId=${attemptId}`;
  const say = `Hola ${doctor}. Maind Health. Alerta urgente: ${patient} espera teleconsulta en la estación. Revise el mensaje SMS o WhatsApp con el enlace. Para reenviar el enlace, marque 1.`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${escapeXml(gatherAction)}" method="POST" timeout="8">
    <Say language="es-MX" voice="alice">${escapeXml(say)}</Say>
  </Gather>
  <Say language="es-MX" voice="alice">Revise el SMS. Gracias.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  return POST(request);
}
