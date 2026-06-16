export const APP_NAME = "MaindHealth";

export const USER_ROLES = [
  "admin",
  "doctor",
  "nurse",
  "reception",
  "patient",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPOINTMENT_MODALITIES = [
  "teleconsulta",
  "presencial",
  "seguimiento",
] as const;
export type AppointmentModality = (typeof APPOINTMENT_MODALITIES)[number];
