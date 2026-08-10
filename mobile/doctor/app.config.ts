import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * projectId de Expo/EAS es obligatorio para push en dispositivos físicos.
 * Colócalo en EXPO_PUBLIC_PROJECT_ID o en extra.eas.projectId tras `eas init`.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
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
      projectId:
        process.env.EXPO_PUBLIC_PROJECT_ID ??
        process.env.EAS_PROJECT_ID ??
        "REPLACE_WITH_EAS_PROJECT_ID",
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://health.maindsteel.com.mx",
    router: {
      origin: false,
    },
  },
  owner: "maindhealth",
});
