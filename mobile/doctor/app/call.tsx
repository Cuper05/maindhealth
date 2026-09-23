import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  buildConsultaBridgeUrl,
  fetchTeleconsultaDetail,
  resolveVideoUrl,
  type TeleconsultaDetail,
} from "@/lib/api";
import { colors } from "@/lib/theme";

type Tab = "video" | "receta";

export default function CallScreen() {
  const params = useLocalSearchParams<{
    url?: string;
    appointmentId?: string;
    tab?: string;
  }>();
  const url = typeof params.url === "string" ? params.url : "";
  const appointmentId = Number(params.appointmentId);
  const [detail, setDetail] = useState<TeleconsultaDetail | null>(null);
  const [showClinical, setShowClinical] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(params.tab === "receta" ? "receta" : "video");
  const [recetaUrl, setRecetaUrl] = useState<string | null>(null);
  const [recetaError, setRecetaError] = useState<string | null>(null);
  const [recetaLoading, setRecetaLoading] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchTeleconsultaDetail(appointmentId);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "No se pudo cargar el clínico");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  useEffect(() => {
    if (params.tab === "receta" && Number.isFinite(appointmentId) && appointmentId > 0) {
      void openReceta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar / cambiar cita
  }, [params.tab, appointmentId]);

  async function openReceta() {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      setRecetaError("Sin cita vinculada para emitir receta.");
      return;
    }
    setRecetaLoading(true);
    setRecetaError(null);
    try {
      const bridge = await buildConsultaBridgeUrl(appointmentId);
      if (!bridge) {
        setRecetaError("Sesión expirada. Cierre sesión y vuelva a entrar.");
        return;
      }
      setRecetaUrl(bridge);
      setTab("receta");
      setShowClinical(false);
    } catch (err) {
      setRecetaError(err instanceof Error ? err.message : "No se pudo abrir la consulta");
    } finally {
      setRecetaLoading(false);
    }
  }

  const videoUrl =
    resolveVideoUrl({
      meetingUrl:
        (detail?.appointment.meetingUrl && detail.appointment.meetingUrl.trim()) || url,
    }) || "";

  if (!videoUrl && tab === "video") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>No hay URL de sala para esta teleconsulta.</Text>
        {Number.isFinite(appointmentId) && appointmentId > 0 ? (
          <Pressable style={styles.recetaBtn} onPress={() => void openReceta()}>
            <Text style={styles.recetaBtnText}>Abrir consulta / crear receta</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const kiosk = detail?.kiosk;
  const clinical = (kiosk?.clinicalDraft ?? {}) as Record<string, unknown>;
  const vitals = (kiosk?.vitalsDraft ?? null) as Record<string, unknown> | null;
  const assessment = kiosk?.assessmentDraft;
  const chief =
    typeof clinical.chiefComplaint === "string" ? clinical.chiefComplaint : null;

  const vitalsLines: string[] = [];
  if (vitals) {
    if (vitals.systolicPressure || vitals.diastolicPressure) {
      vitalsLines.push(`PA ${vitals.systolicPressure ?? "—"}/${vitals.diastolicPressure ?? "—"}`);
    }
    if (vitals.heartRate) vitalsLines.push(`FC ${vitals.heartRate}`);
    if (vitals.oxygenSaturation) vitalsLines.push(`SpO₂ ${vitals.oxygenSaturation}%`);
    if (vitals.temperature) vitalsLines.push(`Temp ${vitals.temperature}°C`);
    if (vitals.weight) vitalsLines.push(`Peso ${vitals.weight} kg`);
  }

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Text style={styles.barText} numberOfLines={1}>
          {detail?.appointment.patientName
            ? `${detail.appointment.patientName} · `
            : params.appointmentId
              ? `Cita #${params.appointmentId} · `
              : ""}
          {tab === "video" ? "Videollamada" : "Consulta / receta"}
        </Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "video" && styles.tabActive]}
          onPress={() => setTab("video")}
        >
          <Text style={[styles.tabText, tab === "video" && styles.tabTextActive]}>Video</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "receta" && styles.tabActive]}
          onPress={() => void openReceta()}
        >
          <Text style={[styles.tabText, tab === "receta" && styles.tabTextActive]}>
            {recetaLoading ? "Abriendo…" : "Crear receta"}
          </Text>
        </Pressable>
      </View>

      {tab === "video" && showClinical ? (
        <View style={styles.clinical}>
          <View style={styles.clinicalHead}>
            <Text style={styles.clinicalTitle}>Datos del paciente</Text>
            <Pressable onPress={() => setShowClinical(false)} hitSlop={8}>
              <Text style={styles.toggle}>Ocultar</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.clinicalScroll} contentContainerStyle={styles.clinicalPad}>
            {detail?.appointment.crisis ? (
              <Text style={styles.crisisBadge}>URGENCIA — complete alta en «Crear receta»</Text>
            ) : null}
            {loadError ? <Text style={styles.warn}>{loadError}</Text> : null}
            {!detail && !loadError ? <ActivityIndicator color={colors.brand} /> : null}
            {chief ? (
              <View style={styles.block}>
                <Text style={styles.label}>Síntomas / motivo</Text>
                <Text style={styles.value}>{chief}</Text>
              </View>
            ) : detail?.appointment.crisis ? (
              <View style={styles.block}>
                <Text style={styles.label}>Síntomas / motivo</Text>
                <Text style={styles.value}>
                  Entró por ayuda urgente — aún sin captura completa en kiosco.
                </Text>
              </View>
            ) : null}
            {vitalsLines.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.label}>Signos vitales</Text>
                <Text style={styles.value}>{vitalsLines.join(" · ")}</Text>
              </View>
            ) : (
              <View style={styles.block}>
                <Text style={styles.label}>Signos vitales</Text>
                <Text style={styles.muted}>Sin lecturas de estación para esta cita.</Text>
              </View>
            )}
            {assessment?.diagnosis ? (
              <View style={styles.block}>
                <Text style={styles.label}>Evaluación estación</Text>
                <Text style={styles.value}>
                  {assessment.diagnosis}
                  {assessment.severity ? ` · ${assessment.severity}` : ""}
                </Text>
              </View>
            ) : null}
            <Pressable style={styles.recetaInline} onPress={() => void openReceta()}>
              <Text style={styles.recetaInlineText}>
                Al terminar → guardar consulta y crear receta →
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      {tab === "video" && !showClinical ? (
        <Pressable style={styles.showClinicalBar} onPress={() => setShowClinical(true)}>
          <Text style={styles.toggle}>Ver signos / síntomas</Text>
        </Pressable>
      ) : null}

      {recetaError ? <Text style={styles.warnBar}>{recetaError}</Text> : null}

      {tab === "video" && videoUrl ? (
        <WebView
          source={{ uri: videoUrl }}
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
      ) : null}

      {tab === "receta" ? (
        recetaUrl ? (
          <WebView
            source={{ uri: recetaUrl }}
            style={styles.web}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brand} size="large" />
                <Text style={[styles.msg, { marginTop: 12 }]}>
                  Abriendo consulta para emitir receta…
                </Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        )
      ) : null}
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
  tabs: {
    flexDirection: "row",
    backgroundColor: "#0f2740",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabText: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 15 },
  tabTextActive: { color: "#fff" },
  clinical: {
    maxHeight: "34%",
    backgroundColor: "#0f2740",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  clinicalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  clinicalTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  clinicalScroll: { flexGrow: 0 },
  clinicalPad: { padding: 12, paddingTop: 6 },
  block: { marginBottom: 8 },
  label: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: { color: "#fff", fontSize: 15, marginTop: 4, lineHeight: 21 },
  muted: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  crisisBadge: {
    backgroundColor: "#b91c1c",
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
  },
  warn: { color: "#fca5a5", fontSize: 12, marginBottom: 6 },
  warnBar: {
    backgroundColor: "#7f1d1d",
    color: "#fecaca",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  toggle: { color: "#fff", fontSize: 12, fontWeight: "700" },
  showClinicalBar: {
    backgroundColor: "#0f2740",
    paddingVertical: 8,
    alignItems: "center",
  },
  recetaInline: {
    marginTop: 8,
    backgroundColor: "#1d6eb8",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  recetaInlineText: { color: "#fff", fontWeight: "800", textAlign: "center", fontSize: 14 },
  recetaBtn: {
    marginTop: 20,
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  recetaBtnText: { color: "#fff", fontWeight: "800" },
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
