import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { fetchTeleconsultas, resolveMeetingOpenUrl, type TeleconsultaItem } from "@/lib/api";
import { clearSession, getUser } from "@/lib/auth-store";
import { registerForPushAsync } from "@/lib/push";
import { playIncomingTeleconsultaAlert } from "@/lib/alerts";
import { colors } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [items, setItems] = useState<TeleconsultaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>("…");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const user = await getUser();
      if (user?.name) setName(user.name);
      const res = await fetchTeleconsultas(false);
      setItems(res.items);
      if (res.user?.name) setName(res.user.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();

      void (async () => {
        try {
          const token = await registerForPushAsync();
          setPushStatus(token ? "Push activo" : "Push pendiente (EAS projectId / permiso)");
        } catch (err) {
          setPushStatus(
            err instanceof Error ? `Push: ${err.message}` : "Push no disponible",
          );
        }
      })();

      const received = Notifications.addNotificationReceivedListener(() => {
        void playIncomingTeleconsultaAlert();
        void load();
      });

      return () => {
        received.remove();
      };
    }, [load]),
  );

  function openItem(item: TeleconsultaItem) {
    const url = resolveMeetingOpenUrl(item);
    if (!url) return;
    router.push({
      pathname: "/call",
      params: {
        url,
        appointmentId: item.appointmentId ? String(item.appointmentId) : "",
      },
    });
  }

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>En espera de teleconsultas</Text>
        <Text style={styles.bannerMeta}>{name ? `Dr(a). ${name}` : "Médico"}</Text>
        <Text style={styles.bannerPush}>{pushStatus}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.brand}
            />
          }
          contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No hay teleconsultas pendientes. Cuando la estación escale un caso, recibirás
              sonido + vibración aquí.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openItem(item)}>
              <View style={styles.cardTop}>
                {item.unread ? <View style={styles.dot} /> : null}
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              {item.body ? (
                <Text style={styles.cardBody} numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={styles.cardCta}>Tocar para unirse a la videollamada →</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.logout} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  banner: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  bannerMeta: { color: "rgba(255,255,255,0.9)", marginTop: 4 },
  bannerPush: { color: "rgba(255,255,255,0.65)", marginTop: 6, fontSize: 12 },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 32 },
  empty: { textAlign: "center", color: colors.muted, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 5,
  },
  cardTitle: { flex: 1, fontWeight: "700", color: colors.text, fontSize: 16 },
  cardBody: { marginTop: 8, color: colors.muted, lineHeight: 20 },
  cardCta: { marginTop: 12, color: colors.brandSoft, fontWeight: "700" },
  error: { color: colors.danger, padding: 16 },
  logout: { position: "absolute", bottom: 20, alignSelf: "center", padding: 12 },
  logoutText: { color: colors.muted, fontWeight: "600" },
});
