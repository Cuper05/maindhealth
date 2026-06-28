import type { UserRole } from "@/lib/constants";

export type Permission =
  | "appointments:view"
  | "appointments:write"
  | "appointments:book"
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
  | "notifications:view"
  | "portal:view"
  | "readings:view"
  | "readings:write"
  | "labs:view"
  | "labs:write"
  | "payments:view"
  | "payments:write"
  | "signatures:write"
  | "messages:view"
  | "messages:write"
  | "alerts:view"
  | "alerts:write"
  | "intake:view"
  | "intake:write";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "appointments:view", "appointments:write", "patients:view", "patients:write",
    "vitals:view", "vitals:write", "consultations:view", "consultations:write",
    "prescriptions:view", "prescriptions:write", "followups:view", "followups:write",
    "users:write", "reports:view", "config:view", "devices:view", "devices:write",
    "notifications:view", "readings:view", "readings:write", "labs:view", "labs:write",
    "payments:view", "payments:write", "signatures:write", "messages:view", "messages:write",
    "alerts:view", "alerts:write", "intake:view", "intake:write",
  ],
  doctor: [
    "appointments:view", "appointments:write", "patients:view", "vitals:view",
    "consultations:view", "consultations:write", "prescriptions:view", "prescriptions:write",
    "followups:view", "followups:write", "devices:view", "notifications:view",
    "readings:view", "labs:view", "labs:write", "payments:view", "signatures:write",
    "messages:view", "messages:write", "alerts:view", "alerts:write", "intake:view",
  ],
  nurse: [
    "appointments:view", "patients:view", "vitals:view", "vitals:write", "devices:view",
    "notifications:view", "readings:view", "readings:write", "labs:view", "labs:write",
    "messages:view", "messages:write", "alerts:view", "alerts:write",
    "intake:view", "intake:write",
  ],
  reception: [
    "appointments:view", "appointments:write", "patients:view", "patients:write",
    "notifications:view", "payments:view", "payments:write", "messages:view", "messages:write",
    "intake:view", "intake:write",
  ],
  patient: [
    "portal:view", "appointments:view", "appointments:book", "prescriptions:view",
    "patients:view", "notifications:view", "labs:view", "payments:view",
    "messages:view", "messages:write",
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  doctor: "Médico",
  nurse: "Enfermería",
  reception: "Recepción",
  patient: "Paciente",
};

export function can(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessRoute(role: UserRole | undefined, href: string): boolean {
  if (!role) return false;
  if (href === "/") return role !== "patient";
  if (href.startsWith("/portal")) return can(role, "portal:view");
  if (href.startsWith("/pacientes")) return can(role, "patients:view");
  if (href.startsWith("/agenda") || href.startsWith("/citas")) return can(role, "appointments:view") && role !== "patient";
  if (href.startsWith("/triage")) return can(role, "vitals:view");
  if (href.startsWith("/consultas")) return can(role, "consultations:view");
  if (href.startsWith("/recetas")) return can(role, "prescriptions:view") && role !== "patient";
  if (href.startsWith("/seguimientos")) return can(role, "followups:view");
  if (href.startsWith("/documentos")) return can(role, "patients:view") && role !== "patient";
  if (href.startsWith("/dispositivos")) return can(role, "devices:view");
  if (href.startsWith("/laboratorio")) return can(role, "labs:view");
  if (href.startsWith("/pagos")) return can(role, "payments:view");
  if (href.startsWith("/mensajes")) return can(role, "messages:view");
  if (href.startsWith("/alertas")) return can(role, "alerts:view");
  if (href.startsWith("/estacion")) return can(role, "intake:view");
  if (href.startsWith("/notificaciones")) return can(role, "notifications:view");
  if (href.startsWith("/reportes")) return can(role, "reports:view");
  if (href.startsWith("/configuracion")) return can(role, "config:view");
  if (href.startsWith("/bitacora")) return can(role, "config:view");
  return role !== "patient";
}

export function defaultHomeForRole(role: UserRole): string {
  return role === "patient" ? "/portal" : "/";
}
