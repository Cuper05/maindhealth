import { requireSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/constants";

export type ActionSession = {
  userId: number;
  name: string;
  role: UserRole;
};

export async function getActionSession(
  permission?: Permission,
): Promise<ActionSession | { error: string }> {
  const session = await requireSession();
  if (!session?.userId || !session.role || !session.name) {
    return { error: "No autenticado" };
  }
  if (permission && !can(session.role, permission)) {
    return { error: "Sin permiso para esta acción" };
  }
  return {
    userId: session.userId,
    name: session.name,
    role: session.role,
  };
}

export function actionError(message: string) {
  return { ok: false as const, error: message };
}

export function actionSuccess<T extends Record<string, unknown>>(data: T) {
  return { ok: true as const, ...data };
}
