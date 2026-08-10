import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "@/lib/theme";

export default function CallScreen() {
  const params = useLocalSearchParams<{ url?: string; appointmentId?: string }>();
  const url = typeof params.url === "string" ? params.url : "";

  if (!url) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>No hay URL de sala para esta teleconsulta.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Text style={styles.barText} numberOfLines={1}>
          {params.appointmentId ? `Cita #${params.appointmentId} · ` : ""}
          Sala Daily / consulta
        </Text>
      </View>
      <WebView
        source={{ uri: url }}
        style={styles.web}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: {
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  barText: { color: "#fff", fontSize: 12 },
  web: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: 24,
  },
  msg: { color: colors.muted, textAlign: "center" },
});
