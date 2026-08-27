/**
 * Lectura Lejia HW-701 desde el servicio local (127.0.0.1:3930).
 * Protocolo ASCII @ 4800: ...$W08710$H1585$b347$Y$
 */

const BRIDGE_URL = "http://127.0.0.1:3930";

export type StationScaleSample = {
  weightKg: number;
  heightM: number;
  bmi: number;
};

export async function readStationScale(
  onProgress?: (msg: string) => void,
): Promise<StationScaleSample> {
  onProgress?.("Contactando servicio local de la báscula…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    onProgress?.(
      "Súbase a la báscula, párese erguido y espere peso y altura en el LED…",
    );
    const res = await fetch(`${BRIDGE_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      weight?: number;
      height?: number;
      bmi?: number;
      error?: string;
      raw?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          "Sin lectura de la báscula. Enciéndala, súbase y espere el LED; abra iniciar-servicio-bascula.bat.",
      );
    }
    const weightKg = Number(data.weight);
    const heightM = Number(data.height);
    const bmi = Number(data.bmi);
    if (!(weightKg >= 20 && weightKg <= 250)) {
      throw new Error("Peso fuera de rango. Baje, espere a cero y vuelva a medirse.");
    }
    if (!(heightM >= 1.0 && heightM <= 2.3)) {
      throw new Error("Altura fuera de rango. Párese erguido bajo el sensor ultrasónico.");
    }
    onProgress?.(
      `Listo: ${weightKg.toFixed(1)} kg · ${(heightM * 100).toFixed(1)} cm · IMC ${Number.isFinite(bmi) ? bmi.toFixed(1) : "—"}`,
    );
    return {
      weightKg,
      heightM,
      bmi: Number.isFinite(bmi)
        ? bmi
        : Number((weightKg / (heightM * heightM)).toFixed(1)),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|abort/i.test(msg)) {
      throw new Error(
        "No se pudo contactar 127.0.0.1:3930. Abra iniciar-servicio-bascula.bat, pulse Leer báscula y, si Chrome pide red local, elija Permitir.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
