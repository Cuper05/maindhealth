import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";

/**
 * Alerta fuerte en primer plano: vibración + tono empaquetado.
 */
export async function playIncomingTeleconsultaAlert() {
  try {
    if (Platform.OS === "android") {
      Vibration.vibrate([0, 400, 200, 400, 200, 600]);
    } else {
      Vibration.vibrate([400, 200, 400, 200, 600]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // ignore
  }

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/teleconsulta.wav"),
      { shouldPlay: true, volume: 1 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // La notificación del SO ya lleva sonido; vibración basta como respaldo.
  }
}
