"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { usersTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { normalizePhoneE164 } from "@/lib/alerts/twilio";

/**
 * Update doctor phone + teleconsulta availability (alert queue).
 */
export async function updateDoctorTeleconsultaContact(
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("users:write");
  if ("error" in session) return actionError(session.error);

  const userId = Number(formData.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) {
    return actionError("Usuario inválido");
  }

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const availableRaw = formData.get("teleconsultaAvailable");
  const teleconsultaAvailable =
    availableRaw === "on" || availableRaw === "true" || availableRaw === "1";

  let phone: string | null = phoneRaw || null;
  if (phone) {
    const normalized = normalizePhoneE164(phone);
    if (!normalized) {
      return actionError("Teléfono inválido. Use 10 dígitos MX o formato +52…");
    }
    phone = normalized;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      phone,
      teleconsultaAvailable,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!updated) return actionError("Usuario no encontrado");

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "actualizar_contacto_teleconsulta",
    recordId: userId,
    detail: `Tel: ${phone ?? "—"} · disponible: ${teleconsultaAvailable}`,
  });

  revalidatePath("/configuracion");
  return actionSuccess({ userId });
}
