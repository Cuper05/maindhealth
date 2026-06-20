import type { UserRole } from "@/lib/constants";

export type Permission =
  | "appointments:view"
  | "appointments:write"
  | "patients:view"
  | "patients:write"
  | "vitals:view"
  | "vitals:write"
  | "consultations:view"
  | "consultations:write"
  | "prescriptions:view"
  | "prescriptions:write"
  | "followups:view"
  | "followups:write"
  | "users:write"
  | "reports:view"
  | "config:view"
  | "devices:view"
  | "devices:write"
  | "notifications:view";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "appointments:view",
    "appointments:write",
    "patients:view",
    "patients:write",
    "vitals:view",
    "vitals:write",
    "consultations:view",
    "consultations:write",
    "prescriptions:view",
    "prescriptions:write",
    "followups:view",
    "followups:write",
    "users:write",
    "reports:view",
    "config:view",
    "devices:view",
    "devices:write",
    "notifications:view",
  ],
  doctor: [
    "appointments:view",
    "appointments:write",
    "patients:view",
    "vitals:view",
    "consultations:view",
    "consultations:write",
    "prescriptions:view",
    "prescriptions:write",
    "followups:view",
    "followups:write",
    "devices:view",
    "notifications:view",
  ],
  nurse: [
    "appointments:view",
    "patients:view",
    "vitals:view",
    "vitals:write",
    "devices:view",
    "notifications:view",
  ],
  reception: [
    "appointments:view",
    "appointments:write",
    "patients:view",
    "patients:write",
    "notifications:view",
  ],
  patient: ["appointments:view"],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  doctor: "Médico",
  nurse: "Enfermería",
  reception: "Recepción",
  patient: "Paciente",
};

export function can(
  role: UserRole | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessRoute(role: UserRole | undefined, href: string): boolean {
  if (!role) return false;
  if (href === "/") return true;
  if (href.startsWith("/pacientes")) return can(role, "patients:view");
  if (href.startsWith("/agenda")) return can(role, "appointments:view");
  if (href.startsWith("/triage")) return can(role, "vitals:view");
  if (href.startsWith("/consultas")) return can(role, "consultations:view");
  if (href.startsWith("/recetas")) return can(role, "prescriptions:view");
  if (href.startsWith("/seguimientos")) return can(role, "followups:view");
  if (href.startsWith("/documentos")) return can(role, "patients:view");
  if (href.startsWith("/dispositivos")) return can(role, "devices:view");
  if (href.startsWith("/notificaciones")) return can(role, "notifications:view");
  if (href.startsWith("/reportes")) return can(role, "reports:view");
  if (href.startsWith("/configuracion")) return can(role, "config:view");
  return true;
}
