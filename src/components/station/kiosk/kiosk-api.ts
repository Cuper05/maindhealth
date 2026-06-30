export async function kioskFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error de red");
  return data as T;
}

export const kioskApi = {
  getSession: () => kioskFetch<{ session: KioskSessionPayload | null; patient?: PatientPayload; appointment?: AppointmentPayload }>("/api/station/session"),
  startSession: () => kioskFetch<{ session: { token: string; currentStep: string } }>("/api/station/session", { method: "POST" }),
  patchSession: (body: Record<string, unknown>) => kioskFetch("/api/station/session", { method: "PATCH", body: JSON.stringify(body) }),
  resetSession: () => kioskFetch("/api/station/session", { method: "DELETE" }),
  todayAppointments: () => kioskFetch<{ appointments: TodayAppointment[] }>("/api/station/appointments/today"),
  lookup: (body: Record<string, string>) => kioskFetch<{ patient: PatientPayload; todayAppointment: TodayAppointment | null }>("/api/station/lookup", { method: "POST", body: JSON.stringify(body) }),
  register: (body: Record<string, unknown>) => kioskFetch<RegisterResult>("/api/station/register", { method: "POST", body: JSON.stringify(body) }),
  submitIntake: (body: Record<string, unknown>) => kioskFetch("/api/station/intake", { method: "POST", body: JSON.stringify(body) }),
  patchVitals: (patch: Record<string, string>, deviceStatus?: string) =>
    kioskFetch<{ vitalsDraft: VitalsDraft }>("/api/station/vitals", { method: "PATCH", body: JSON.stringify({ patch, deviceStatus }) }),
  confirmVitals: () => kioskFetch<{ vitalSignId: number }>("/api/station/vitals", { method: "POST" }),
  pollReadings: (appointmentId: number) =>
    kioskFetch<{ draft: VitalsDraft }>(`/api/station/readings?appointmentId=${appointmentId}`),
  doctors: () => kioskFetch<{ doctors: DoctorOption[] }>("/api/station/doctors"),
};

export type VitalsDraft = {
  systolicPressure?: string;
  diastolicPressure?: string;
  heartRate?: string;
  oxygenSaturation?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  bmi?: string;
};

export type KioskSessionPayload = {
  token: string;
  currentStep: string;
  patientType?: string | null;
  patientId?: number | null;
  appointmentId?: number | null;
  deviceStatus: string;
  vitalsDraft: VitalsDraft;
  clinicalDraft: Record<string, unknown>;
  vitalSignId?: number | null;
  status: string;
};

export type PatientPayload = {
  id: number;
  chartNumber: string;
  name: string;
  birthDate?: string | null;
  sex?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type AppointmentPayload = {
  id: number;
  startAt: string;
  meetingUrl?: string | null;
  modality: string;
  statusCode: string;
  doctorName: string;
};

export type TodayAppointment = {
  id: number;
  startAt: string;
  patientId: number;
  chartNumber: string;
  patientName: string;
  doctorName: string;
  meetingUrl?: string | null;
  modality: string;
  intakeComplete: boolean;
};

export type DoctorOption = { id: number; name: string; specialty?: string | null };

export type RegisterResult = {
  patientId: number;
  appointmentId: number;
  chartNumber: string;
  patientName: string;
  startAt: string;
  doctorName: string;
  modality: string;
};
