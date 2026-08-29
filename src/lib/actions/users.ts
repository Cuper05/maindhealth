"use server";

import { and, eq, ne } from "drizzle-orm";
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
  revalidatePath("/medicos");
  return actionSuccess({ userId });
}

/** Edición completa de perfil de usuario / médico (admin). */
export async function updateUserProfile(
  userId: number,
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("users:write");
  if ("error" in session) return actionError(session.error);

  if (!Number.isFinite(userId) || userId <= 0) {
    return actionError("Usuario inválido");
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastNamePaternal = String(formData.get("lastNamePaternal") ?? "").trim();
  const lastNameMaternal = String(formData.get("lastNameMaternal") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const professionalLicense =
    String(formData.get("professionalLicense") ?? "").trim() || null;
  const active =
    formData.get("active") === "on" ||
    formData.get("active") === "true" ||
    formData.get("active") === "1";
  const teleconsultaAvailable =
    formData.get("teleconsultaAvailable") === "on" ||
    formData.get("teleconsultaAvailable") === "true" ||
    formData.get("teleconsultaAvailable") === "1";
  const password = String(formData.get("password") ?? "");

  if (!firstName || !lastNamePaternal) {
    return actionError("Nombre y apellido paterno son requeridos");
  }
  if (!email || !email.includes("@")) {
    return actionError("Correo inválido");
  }

  let phone: string | null = phoneRaw || null;
  if (phone) {
    const normalized = normalizePhoneE164(phone);
    if (!normalized) {
      return actionError("Teléfono inválido. Use 10 dígitos MX o formato +52…");
    }
    phone = normalized;
  }

  const [existing] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!existing) return actionError("Usuario no encontrado");

  const [emailTaken] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.email, email), ne(usersTable.id, userId)))
    .limit(1);
  if (emailTaken) {
    return actionError("Ese correo ya está registrado en otro usuario.");
  }

  const patch: {
    firstName: string;
    lastNamePaternal: string;
    lastNameMaternal: string | null;
    email: string;
    phone: string | null;
    specialty: string | null;
    professionalLicense: string | null;
    active: boolean;
    teleconsultaAvailable: boolean;
    updatedAt: Date;
    passwordHash?: string;
  } = {
    firstName,
    lastNamePaternal,
    lastNameMaternal,
    email,
    phone,
    specialty,
    professionalLicense,
    active,
    teleconsultaAvailable,
    updatedAt: new Date(),
  };

  if (password.length > 0) {
    if (password.length < 6) {
      return actionError("La contraseña debe tener al menos 6 caracteres.");
    }
    const bcrypt = await import("bcryptjs");
    patch.passwordHash = await bcrypt.hash(password, 10);
  }

  await db.update(usersTable).set(patch).where(eq(usersTable.id, userId));

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "actualizar_usuario",
    recordId: userId,
    detail: `Perfil ${email}${password ? " · contraseña cambiada" : ""}`,
  });

  revalidatePath("/configuracion");
  revalidatePath("/medicos");
  return actionSuccess({ userId });
}

export async function deactivateUser(userId: number) {
  const session = await getActionSession("users:write");
  if ("error" in session) return actionError(session.error);
  if (session.userId === userId) {
    return actionError("No puede desactivarse a usted mismo.");
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      active: false,
      teleconsultaAvailable: false,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!updated) return actionError("Usuario no encontrado");

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "desactivar_usuario",
    recordId: userId,
    detail: "Usuario desactivado",
  });

  revalidatePath("/configuracion");
  revalidatePath("/medicos");
  return actionSuccess({ userId });
}

export async function reactivateUser(userId: number) {
  const session = await getActionSession("users:write");
  if ("error" in session) return actionError(session.error);

  const [updated] = await db
    .update(usersTable)
    .set({ active: true, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!updated) return actionError("Usuario no encontrado");

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "reactivar_usuario",
    recordId: userId,
    detail: "Usuario reactivado",
  });

  revalidatePath("/configuracion");
  revalidatePath("/medicos");
  return actionSuccess({ userId });
}

/**
 * Borrado definitivo solo si no hay historial clínico ligado.
 * Si hay historial, use desactivar.
 */
export async function deleteUserPermanent(userId: number) {
  const session = await getActionSession("users:write");
  if ("error" in session) return actionError(session.error);
  if (session.role !== "admin") {
    return actionError("Solo un administrador puede borrar usuarios de forma definitiva.");
  }
  if (session.userId === userId) {
    return actionError("No puede borrarse a usted mismo.");
  }

  const { count } = await import("drizzle-orm");
  const {
    appointmentsTable,
    consultationsTable,
    prescriptionsTable,
    followUpsTable,
    digitalSignaturesTable,
    stationResponsiblePhysiciansTable,
  } = await import("@/lib/db/schema");

  const [[appts], [cons], [rx], [fu], [sigs], [resp]] = await Promise.all([
    db.select({ n: count() }).from(appointmentsTable).where(eq(appointmentsTable.doctorId, userId)),
    db
      .select({ n: count() })
      .from(consultationsTable)
      .where(eq(consultationsTable.doctorId, userId)),
    db
      .select({ n: count() })
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.doctorId, userId)),
    db.select({ n: count() }).from(followUpsTable).where(eq(followUpsTable.doctorId, userId)),
    db
      .select({ n: count() })
      .from(digitalSignaturesTable)
      .where(eq(digitalSignaturesTable.signedById, userId)),
    db
      .select({ n: count() })
      .from(stationResponsiblePhysiciansTable)
      .where(eq(stationResponsiblePhysiciansTable.doctorId, userId)),
  ]);

  const linked =
    Number(appts?.n ?? 0) +
    Number(cons?.n ?? 0) +
    Number(rx?.n ?? 0) +
    Number(fu?.n ?? 0) +
    Number(sigs?.n ?? 0) +
    Number(resp?.n ?? 0);

  if (linked > 0) {
    return actionError(
      "Este médico tiene historial clínico o está asignado a la estación. Desactívelo en lugar de borrarlo.",
    );
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "borrar_usuario",
    recordId: userId,
    detail: "Usuario eliminado definitivamente",
  });

  revalidatePath("/configuracion");
  revalidatePath("/medicos");
  return actionSuccess({ userId });
}
