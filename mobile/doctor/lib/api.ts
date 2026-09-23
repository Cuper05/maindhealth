import Constants from "expo-constants";
import { getToken } from "./auth-store";

const FALLBACK_API = "https://health.maindsteel.com.mx";

export function getApiUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return (fromEnv || fromExtra || FALLBACK_API).replace(/\/$/, "");
}

export type MobileUser = {
  id: number;
  name: string;
  role: string;
  email?: string;
};

export type ClinicalSummary = {
  crisis: boolean;
  chiefComplaint: string | null;
  vitalsLine: string | null;
  redFlags: string[];
  diagnosis: string | null;
  severity: string | null;
  summary: string | null;
  paymentStatus: string | null;
};

export type TeleconsultaItem = {
  id: number;
  title: string;
  body: string | null;
  href: string | null;
  meetingUrl: string | null;
  appointmentId: number | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
  clinicalSummary?: ClinicalSummary;
};

export type TeleconsultaDetail = {
  ok: true;
  appointment: {
    id: number;
    reason: string | null;
    meetingUrl: string | null;
    patientId: number;
    patientName: string;
    chartNumber: string;
    birthDate: string | null;
    sex: string | null;
    phone: string | null;
    crisis: boolean;
  };
  kiosk: {
    clinicalDraft: Record<string, unknown>;
    vitalsDraft: Record<string, unknown> | null;
    assessmentDraft: {
      diagnosis?: string | null;
      severity?: string | null;
      summary?: string | null;
      redFlags?: string[];
    } | null;
    paymentStatus: string | null;
  } | null;
};

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const auth = token === undefined ? await getToken() : token;
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(headers as Record<string, string>),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `Error HTTP ${res.status}`);
  }
  return data;
}

export async function loginRequest(email: string, password: string) {
  return apiFetch<{ ok: true; token: string; user: MobileUser }>("/api/mobile/auth/login", {
    method: "POST",
    token: null,
    body: JSON.stringify({ email, password }),
  });
}

export async function registerPushToken(token: string, platform: "ios" | "android" | "web") {
  return apiFetch<{ ok: true }>("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({ token, platform, action: "register" }),
  });
}

export async function unregisterPushToken(token: string) {
  return apiFetch<{ ok: true }>("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({ token, action: "unregister" }),
  });
}

export async function fetchTeleconsultas(unread = false) {
  const q = unread ? "?unread=1" : "";
  return apiFetch<{ ok: true; user: MobileUser; items: TeleconsultaItem[] }>(
    `/api/mobile/teleconsultas${q}`,
  );
}

export async function fetchTeleconsultaDetail(appointmentId: number) {
  return apiFetch<TeleconsultaDetail>(`/api/mobile/teleconsultas/${appointmentId}`);
}

/**
 * Sala Daily para el celular del médico.
 * La cámara del celular se publica, pero no se muestra: en pantalla va el paciente.
 */
export function resolveVideoUrl(item: {
  meetingUrl?: string | null;
}): string | null {
  if (!item.meetingUrl || !/^https?:\/\//i.test(item.meetingUrl)) return null;
  try {
    const url = new URL(item.meetingUrl);
    const host = url.hostname.toLowerCase();
    if (host === "daily.co" || host.endsWith(".daily.co")) {
      url.searchParams.set("showLocalVideo", "false");
      url.searchParams.set("activeSpeakerMode", "true");
    }
    return url.toString();
  } catch {
    return item.meetingUrl;
  }
}

/** @deprecated Prefer resolveVideoUrl + appointmentId + pestaña receta (bridge). */
export function resolveMeetingOpenUrl(item: {
  meetingUrl?: string | null;
  href?: string | null;
  appointmentId?: number | null;
}): string | null {
  return resolveVideoUrl(item);
}

/** WebView: autentica cookie de sesión y abre la consulta para emitir receta. */
export async function buildConsultaBridgeUrl(appointmentId: number): Promise<string | null> {
  const token = await getToken();
  if (!token || !appointmentId) return null;
  const api = getApiUrl();
  return `${api}/api/mobile/session/bridge?token=${encodeURIComponent(token)}&appointmentId=${appointmentId}`;
}
