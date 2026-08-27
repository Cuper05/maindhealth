/**
 * Envío de correo vía Resend (HTTPS).
 * Requiere RESEND_API_KEY y EMAIL_FROM en el entorno.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    /** Contenido en base64 */
    content: string;
    contentType?: string;
  }>;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; skipped?: boolean };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return isValidEmail(email) ? email : null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = normalizeEmail(input.to);
  if (!to) {
    return { ok: false, error: "Correo del destinatario inválido" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "MaindHealth <noreply@maindhealth.local>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurada — no se envió correo a", to);
    return {
      ok: false,
      skipped: true,
      error: "Correo no configurado en el servidor (RESEND_API_KEY)",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType ?? "application/pdf",
        })),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg =
        data.error?.message || data.message || `Error al enviar correo (${res.status})`;
      console.error("[email] Resend error", msg);
      return { ok: false, error: msg };
    }

    return { ok: true, id: data.id || "sent" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo enviar el correo";
    console.error("[email]", error);
    return { ok: false, error: msg };
  }
}
