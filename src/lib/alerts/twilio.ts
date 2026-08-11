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
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
  return { accountSid, authToken, fromNumber, whatsappFrom };
}

export function isTwilioConfigured(): boolean {
  const { accountSid, authToken, fromNumber } = twilioConfig();
  return Boolean(accountSid && authToken && fromNumber);
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
    };
    if (!res.ok || !data.sid) {
      const error =
        data.message || data.error_message || `Twilio HTTP ${res.status}`;
      console.error("[twilio]", path, error);
      return { ok: false, error };
    }
    return { ok: true, sid: data.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error de red Twilio";
    console.error("[twilio]", path, err);
    return { ok: false, error };
  }
}

export async function sendSms(input: {
  to: string;
  body: string;
}): Promise<TwilioSendResult> {
  const { fromNumber } = twilioConfig();
  const to = normalizePhoneE164(input.to);
  if (!fromNumber) return { ok: false, error: "TWILIO_FROM_NUMBER no configurada", skipped: true };
  if (!to) return { ok: false, error: "Teléfono inválido" };
  return twilioFormPost("Messages.json", {
    To: to,
    From: fromNumber,
    Body: input.body,
  });
}

export async function sendWhatsApp(input: {
  to: string;
  body: string;
}): Promise<TwilioSendResult> {
  const { whatsappFrom, fromNumber } = twilioConfig();
  const from = whatsappFrom || (fromNumber ? `whatsapp:${fromNumber}` : null);
  const toPhone = normalizePhoneE164(input.to);
  if (!from) {
    return { ok: false, error: "TWILIO_WHATSAPP_FROM no configurada", skipped: true };
  }
  if (!toPhone) return { ok: false, error: "Teléfono inválido" };
  const to = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  return twilioFormPost("Messages.json", {
    To: to,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: input.body,
  });
}

export async function placeVoiceCall(input: {
  to: string;
  /** Absolute URL that returns TwiML. */
  twimlUrl: string;
  statusCallback?: string;
}): Promise<TwilioSendResult> {
  const { fromNumber } = twilioConfig();
  const to = normalizePhoneE164(input.to);
  if (!fromNumber) return { ok: false, error: "TWILIO_FROM_NUMBER no configurada", skipped: true };
  if (!to) return { ok: false, error: "Teléfono inválido" };
  const params: Record<string, string> = {
    To: to,
    From: fromNumber,
    Url: input.twimlUrl,
    Method: "POST",
  };
  if (input.statusCallback) {
    params.StatusCallback = input.statusCallback;
    params.StatusCallbackEvent = "completed";
  }
  return twilioFormPost("Calls.json", params);
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
