import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { parsePushData } from "@/lib/push";
import { resolveMeetingOpenUrl } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = parsePushData(response.notification.request.content.data);
      const url = resolveMeetingOpenUrl(data);
      if (url) {
        router.push({
          pathname: "/call",
          params: {
            url,
            appointmentId: data.appointmentId ? String(data.appointmentId) : "",
          },
        });
      } else {
        router.push("/home");
      }
    });
    return () => sub.remove();
  }, [router]);

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
        <Stack.Screen name="call" options={{ title: "Videollamada", presentation: "modal" }} />
      </Stack>
    </>
  );
}
