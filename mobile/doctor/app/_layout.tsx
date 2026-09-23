import { Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { parsePushData, type TeleconsultaPushData } from "@/lib/push";
import { resolveVideoUrl } from "@/lib/api";
import { colors } from "@/lib/theme";

function openCallFromPush(
  router: ReturnType<typeof useRouter>,
  data: TeleconsultaPushData,
) {
  if (!data.appointmentId && !data.meetingUrl) {
    router.push("/home");
    return;
  }
  router.push({
    pathname: "/call",
    params: {
      url: resolveVideoUrl(data) ?? data.meetingUrl ?? "",
      appointmentId: data.appointmentId ? String(data.appointmentId) : "",
      tab: "video",
    },
  });
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = parsePushData(notification.request.content.data);
      if (!data.appointmentId && !data.meetingUrl) return;
      if (segments.includes("login") || segments.includes("call")) return;
      openCallFromPush(router, data);
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = parsePushData(response.notification.request.content.data);
      openCallFromPush(router, data);
    });

    return () => {
      received.remove();
      tapped.remove();
    };
  }, [router, segments]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Iniciar sesión", headerShown: false }} />
        <Stack.Screen name="home" options={{ title: "Teleconsultas", headerBackVisible: false }} />
        <Stack.Screen name="call" options={{ title: "Teleconsulta", presentation: "modal" }} />
      </Stack>
    </>
  );
}
