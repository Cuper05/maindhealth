/**
 * Detección ligera de inconsistencias de dispositivos en estación.
 * Genera avisos locales + voz; el staff puede revisar en consola / futuros reportes.
 */

export type DeviceHealthIssue = {
  device: "oxygen" | "blood_pressure" | "weight_height" | "temperature" | "ecg" | "print";
  code: string;
  message: string;
  at: string;
};

const STORAGE_KEY = "maindhealth:station-device-issues";

export function loadDeviceIssues(): DeviceHealthIssue[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeviceHealthIssue[];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

export function reportDeviceIssue(issue: Omit<DeviceHealthIssue, "at">) {
  const full: DeviceHealthIssue = { ...issue, at: new Date().toISOString() };
  try {
    const prev = loadDeviceIssues();
    prev.push(full);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(-40)));
  } catch {
    /* ignore */
  }
  console.warn("[station-device-health]", full);
  return full;
}

/** Heurística simple sobre lecturas de signos vitales. */
export function checkVitalsConsistency(draft: {
  systolicPressure?: string;
  diastolicPressure?: string;
  heartRate?: string;
  oxygenSaturation?: string;
  temperature?: string;
  weight?: string;
  height?: string;
}): DeviceHealthIssue | null {
  const spo2 = Number(draft.oxygenSaturation);
  const hr = Number(draft.heartRate);
  const sys = Number(draft.systolicPressure);
  const dia = Number(draft.diastolicPressure);
  const temp = Number(draft.temperature);
  const weight = Number(draft.weight);

  if (draft.oxygenSaturation && (spo2 < 70 || spo2 > 100)) {
    return reportDeviceIssue({
      device: "oxygen",
      code: "spo2_out_of_range",
      message: "Oxímetro: lectura fuera de rango. Revisar sensor o dedo colocado.",
    });
  }
  if (draft.heartRate && (hr < 30 || hr > 220)) {
    return reportDeviceIssue({
      device: "oxygen",
      code: "hr_out_of_range",
      message: "Pulso fuera de rango. Revisar oxímetro o presión.",
    });
  }
  if (draft.systolicPressure && draft.diastolicPressure && (sys < 60 || sys > 250 || dia < 30 || dia > 150 || sys <= dia)) {
    return reportDeviceIssue({
      device: "blood_pressure",
      code: "bp_inconsistent",
      message: "Presión arterial inconsistente. Revisar brazalete y repetir medición.",
    });
  }
  if (draft.temperature && (temp < 34 || temp > 42)) {
    return reportDeviceIssue({
      device: "temperature",
      code: "temp_out_of_range",
      message: "Temperatura fuera de rango. Revisar sensor.",
    });
  }
  if (draft.weight && (weight < 20 || weight > 250)) {
    return reportDeviceIssue({
      device: "weight_height",
      code: "weight_out_of_range",
      message: "Peso fuera de rango. Revisar báscula.",
    });
  }
  return null;
}
