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

/** Absolute URL for WebView / browser: Daily room or web consulta page. */
export function resolveMeetingOpenUrl(item: {
  meetingUrl?: string | null;
  href?: string | null;
  appointmentId?: number | null;
}): string | null {
  if (item.meetingUrl && /^https?:\/\//i.test(item.meetingUrl)) {
    return item.meetingUrl;
  }
  if (item.href && /^https?:\/\//i.test(item.href)) {
    return item.href;
  }
  if (item.appointmentId) {
    return `${getApiUrl()}/consultas/cita/${item.appointmentId}#video`;
  }
  if (item.href?.startsWith("/")) {
    return `${getApiUrl()}${item.href}`;
  }
  return null;
}
