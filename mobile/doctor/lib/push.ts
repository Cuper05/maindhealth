import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./api";
import { playIncomingTeleconsultaAlert } from "./alerts";

const TELECONSULTA_CHANNEL = "teleconsulta";

Notifications.setNotificationHandler({
  handleNotification: async () => {
    void playIncomingTeleconsultaAlert();
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export type TeleconsultaPushData = {
  appointmentId?: number;
  meetingUrl?: string | null;
  href?: string | null;
};

export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(TELECONSULTA_CHANNEL, {
    name: "Teleconsultas urgentes",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 600],
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
}

function projectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_PROJECT_ID;
  const id = fromEnv || fromExtra;
  if (!id || id === "REPLACE_WITH_EAS_PROJECT_ID") return undefined;
  return id;
}

export async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[push] Se necesita un dispositivo físico para push remoto");
    return null;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("[push] Permiso denegado");
    return null;
  }

  const pid = projectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    pid ? { projectId: pid } : undefined,
  );
  const token = tokenResponse.data;

  const platform =
    Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

  try {
    await registerPushToken(token, platform);
  } catch (err) {
    console.warn("[push] No se pudo registrar token en API", err);
  }

  return token;
}

export function parsePushData(data: unknown): TeleconsultaPushData {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const appointmentId =
    typeof d.appointmentId === "number"
      ? d.appointmentId
      : typeof d.appointmentId === "string"
        ? Number(d.appointmentId)
        : undefined;
  return {
    appointmentId: Number.isFinite(appointmentId) ? appointmentId : undefined,
    meetingUrl: typeof d.meetingUrl === "string" ? d.meetingUrl : null,
    href: typeof d.href === "string" ? d.href : null,
  };
}
