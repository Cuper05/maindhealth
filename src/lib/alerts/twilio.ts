/**
 * Twilio Voice + SMS + WhatsApp (same account).
 * Uses REST API (no SDK) to keep dependencies light.
 */

export type TwilioSendResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; skipped?: boolean };

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
  return { accountSid, authToken, fromNumber, messagingServiceSid, whatsappFrom };
}

export function isTwilioConfigured(): boolean {
  const { accountSid, authToken, fromNumber, messagingServiceSid } = twilioConfig();
  return Boolean(accountSid && authToken && (fromNumber || messagingServiceSid));
}

/** Normalize MX / E.164 phones for Twilio. */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+") && /^\+[1-9]\d{7,14}$/.test(trimmed.replace(/\s/g, ""))) {
    return trimmed.replace(/\s/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function authHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function twilioFormPost(
  path: string,
  params: Record<string, string>,
  label?: string,
): Promise<TwilioSendResult> {
  const { accountSid, authToken } = twilioConfig();
  if (!accountSid || !authToken) {
    return { ok: false, error: "Twilio no configurado", skipped: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`;
  const body = new URLSearchParams(params);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      error_message?: string;
      code?: number;
    };
    if (!res.ok || !data.sid) {
      const error =
        data.message || data.error_message || `Twilio HTTP ${res.status}`;
      console.error("[twilio]", label || path, error, data.code ? `code=${data.code}` : "");
      return { ok: false, error };
    }
    console.info("[twilio]", label || path, "ok", data.sid);
    return { ok: true, sid: data.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error de red Twilio";
    console.error("[twilio]", label || path, err);
    return { ok: false, error };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build Spanish urgency TwiML (inline — no dependency on Url fetch). */
export function buildTeleconsultaVoiceTwiml(input: {
  attemptId: number;
  doctorName: string;
  patientLabel: string;
  gatherBaseUrl?: string;
}): string {
  const base = (input.gatherBaseUrl || appBaseUrl()).replace(/\/$/, "");
  const gatherAction = `${base}/api/alerts/twilio/gather?attemptId=${input.attemptId}`;
  const say = `Hola ${input.doctorName}. Maind Health. Alerta urgente: ${input.patientLabel} espera teleconsulta en la estación. Revise el mensaje SMS con el enlace. Para reenviar el enlace, marque 1.`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${escapeXml(gatherAction)}" method="POST" timeout="10">
    <Say language="es-MX" voice="alice">${escapeXml(say)}</Say>
  </Gather>
  <Say language="es-MX" voice="alice">Revise el SMS. Gracias.</Say>
  <Hangup/>
</Response>`;
}

export async function sendSms(input: {
  to: string;
  body: string;
}): Promise<TwilioSendResult> {
  const { fromNumber, messagingServiceSid } = twilioConfig();
  const to = normalizePhoneE164(input.to);
  if (!to) return { ok: false, error: "Teléfono inválido" };
  if (!messagingServiceSid && !fromNumber) {
    return { ok: false, error: "TWILIO_FROM_NUMBER o TWILIO_MESSAGING_SERVICE_SID no configurada", skipped: true };
  }

  const params: Record<string, string> = {
    To: to,
    Body: input.body,
  };
  // Prefer Messaging Service (more reliable with Twilio Notify / trial setups).
  if (messagingServiceSid) {
    params.MessagingServiceSid = messagingServiceSid;
  } else if (fromNumber) {
    // Never send SMS with a whatsapp: address.
    if (fromNumber.toLowerCase().startsWith("whatsapp:")) {
      return { ok: false, error: "TWILIO_FROM_NUMBER no puede ser WhatsApp para SMS" };
    }
    params.From = fromNumber;
  }

  return twilioFormPost("Messages.json", params, "sms");
}

export async function sendWhatsApp(input: {
  to: string;
  body: string;
}): Promise<TwilioSendResult> {
  const { whatsappFrom } = twilioConfig();
  const toPhone = normalizePhoneE164(input.to);
  if (!whatsappFrom) {
    return { ok: false, error: "TWILIO_WHATSAPP_FROM no configurada", skipped: true };
  }
  // Soft-disable until sandbox/sender is valid (avoids Channel From errors drowning SMS diagnosis).
  if (process.env.TWILIO_WHATSAPP_ENABLED?.trim() !== "true") {
    return { ok: false, error: "WhatsApp desactivado (TWILIO_WHATSAPP_ENABLED≠true)", skipped: true };
  }
  if (!toPhone) return { ok: false, error: "Teléfono inválido" };
  const from = whatsappFrom.startsWith("whatsapp:")
    ? whatsappFrom
    : `whatsapp:${whatsappFrom}`;
  const to = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  return twilioFormPost(
    "Messages.json",
    {
      To: to,
      From: from,
      Body: input.body,
    },
    "whatsapp",
  );
}

export async function placeVoiceCall(input: {
  to: string;
  /** Absolute URL that returns TwiML (fallback). */
  twimlUrl?: string;
  /** Inline TwiML backup if Url is omitted. */
  twiml?: string;
  statusCallback?: string;
}): Promise<TwilioSendResult> {
  const { fromNumber } = twilioConfig();
  const to = normalizePhoneE164(input.to);
  if (!fromNumber) return { ok: false, error: "TWILIO_FROM_NUMBER no configurada", skipped: true };
  if (fromNumber.toLowerCase().startsWith("whatsapp:")) {
    return { ok: false, error: "TWILIO_FROM_NUMBER inválido para voz" };
  }
  if (!to) return { ok: false, error: "Teléfono inválido" };
  if (!input.twiml && !input.twimlUrl) {
    return { ok: false, error: "Falta Twiml o twimlUrl" };
  }

  const params: Record<string, string> = {
    To: to,
    From: fromNumber,
  };
  // Prefer Url on APP_BASE_URL (health.maindsteel.com.mx) for Gather callbacks.
  if (input.twimlUrl) {
    params.Url = input.twimlUrl;
    params.Method = "POST";
  } else if (input.twiml) {
    params.Twiml = input.twiml;
  }
  if (input.statusCallback) {
    params.StatusCallback = input.statusCallback;
    params.StatusCallbackEvent = "completed";
  }
  return twilioFormPost("Calls.json", params, "voice");
}

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://health.maindsteel.com.mx"
  ).replace(/\/$/, "");
}

export function teleconsultaEscalateSeconds(): number {
  const raw = Number(process.env.TELECONSULTA_ESCALATE_SECONDS);
  if (Number.isFinite(raw) && raw >= 15 && raw <= 600) return Math.floor(raw);
  return 45;
}
