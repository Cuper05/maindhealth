import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * Project ID real de Expo/EAS (obligatorio para push).
 * Obtenerlo con `eas init` y ponerlo en EXPO_PUBLIC_PROJECT_ID.
 * No inventar UUIDs.
 */
function easProjectId(): string | undefined {
  const id =
    process.env.EXPO_PUBLIC_PROJECT_ID?.trim() ||
    process.env.EAS_PROJECT_ID?.trim() ||
    undefined;
  if (!id || id === "REPLACE_WITH_EAS_PROJECT_ID" || id.startsWith("xxxx")) {
    return undefined;
  }
  return id;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = easProjectId();

  return {
    ...config,
    name: "MaindHealth Médicos",
    slug: "maindhealth-doctor",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "maindhealth-doctor",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0B3D2E",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "mx.com.maindsteel.maindhealth.doctor",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0B3D2E",
      },
      package: "mx.com.maindsteel.maindhealth.doctor",
      permissions: ["VIBRATE", "RECEIVE_BOOT_COMPLETED", "POST_NOTIFICATIONS"],
    },
    plugins: [
      "expo-router",
      [
        "expo-notifications",
        {
          sounds: ["./assets/teleconsulta.wav"],
          icon: "./assets/notification-icon.png",
          color: "#0B3D2E",
          defaultChannel: "teleconsulta",
        },
      ],
    ],
    extra: {
      eas: {
        ...(projectId ? { projectId } : {}),
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://health.maindsteel.com.mx",
      router: {
        origin: false,
      },
    },
    owner: "maindhealth",
  };
};
