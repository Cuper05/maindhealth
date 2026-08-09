export async function kioskFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const text = await res.text();
  let data: { error?: string } & Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(res.ok ? "Respuesta inválida del servidor" : `Error del servidor (${res.status})`);
    }
  }
  if (!res.ok) throw new Error(data.error ?? `Error de red (${res.status})`);
  return data as T;
}

export type AssessmentPayload = {
  diagnosis: string;
  severity: "low" | "moderate" | "high" | "critical";
  requiresDoctor: boolean;
  summary: string;
  treatmentPlan: string;
  instructions: string;
  redFlags: string[];
  medications: Array<{
    medication: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    route?: string;
    instructions?: string;
  }>;
  engine: "rules" | "openai";
  protocolCode?: string | null;
  protocolName?: string | null;
  prescriptionAuthorized?: boolean;
  responsibleDoctorName?: string | null;
  responsibleDoctorLicense?: string | null;
  consultationId?: number | null;
  prescriptionId?: number | null;
  prescriptionFolio?: string | null;
};

export type StationService = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
};

export type PaymentOrder = {
  id: number;
  reference: string;
  amountCents: number;
  currency: string;
  concept: string;
  status: string;
  provider: string;
  approvedAt?: string | Date | null;
  providerReference?: string | null;
};

export const kioskApi = {
  getSession: () =>
    kioskFetch<{
      session: KioskSessionPayload | null;
      patient?: PatientPayload;
      appointment?: AppointmentPayload;
      paymentOrder?: PaymentOrder | null;
    }>("/api/station/session"),
  startSession: () =>
    kioskFetch<{ session: { token: string; currentStep: string } }>("/api/station/session", { method: "POST" }),
  patchSession: (body: Record<string, unknown>) =>
    kioskFetch("/api/station/session", { method: "PATCH", body: JSON.stringify(body) }),
  resetSession: () => kioskFetch("/api/station/session", { method: "DELETE" }),
  listServices: () => kioskFetch<{ services: StationService[] }>("/api/station/services"),
  createPayment: (serviceId: number) =>
    kioskFetch<{ order: PaymentOrder; service: StationService }>("/api/station/payment", {
      method: "POST",
      body: JSON.stringify({ serviceId }),
    }),
  confirmPayment: (paymentOrderId: number, status: "approved" | "rejected" | "cancelled" | "error") =>
    kioskFetch<{ order: PaymentOrder; nextStep: string }>("/api/station/payment", {
      method: "PATCH",
      body: JSON.stringify({ paymentOrderId, status, provider: "demo" }),
    }),
  lookup: (body: Record<string, string>) =>
    kioskFetch<{ patient: PatientPayload }>("/api/station/lookup", { method: "POST", body: JSON.stringify(body) }),
  startWalkIn: (patientId: number) =>
    kioskFetch<RegisterResult>("/api/station/walk-in", {
      method: "POST",
      body: JSON.stringify({ patientId }),
    }),
  register: (body: Record<string, unknown>) =>
    kioskFetch<RegisterResult>("/api/station/register", { method: "POST", body: JSON.stringify(body) }),
  submitIntake: (body: Record<string, unknown>) =>
    kioskFetch("/api/station/intake", { method: "POST", body: JSON.stringify(body) }),
  patchVitals: (patch: Record<string, string>, deviceStatus?: string) =>
    kioskFetch<{ vitalsDraft: VitalsDraft }>("/api/station/vitals", {
      method: "PATCH",
      body: JSON.stringify({ patch, deviceStatus }),
    }),
  confirmVitals: () => kioskFetch<{ vitalSignId: number }>("/api/station/vitals", { method: "POST" }),
  assess: () =>
    kioskFetch<{
      path: "autonomous" | "doctor";
      step: "result" | "waiting";
      assessment: AssessmentPayload;
      meetingUrl: string | null;
    }>("/api/station/assess", { method: "POST" }),
  pollReadings: (appointmentId: number) =>
    kioskFetch<{ draft: VitalsDraft }>(`/api/station/readings?appointmentId=${appointmentId}`),
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
  serviceId?: number | null;
  paymentOrderId?: number | null;
  paymentStatus?: string | null;
  deviceStatus: string;
  vitalsDraft: VitalsDraft;
  clinicalDraft: Record<string, unknown>;
  assessmentDraft?: AssessmentPayload | null;
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

export type RegisterResult = {
  patientId: number;
  appointmentId: number;
  chartNumber: string;
  patientName: string;
  startAt: string;
  doctorName: string;
  modality: string;
};
