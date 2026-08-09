import type { KioskVitalsDraft } from "@/lib/db/schema/station-kiosk";

export function computeBmiFromDraft(draft: KioskVitalsDraft): string | undefined {
  const weight = Number(draft.weight);
  const height = Number(draft.height);
  if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) return undefined;
  const meters = height > 3 ? height / 100 : height;
  const bmi = weight / (meters * meters);
  return bmi.toFixed(1);
}

export function mergeVitalsDraft(
  current: KioskVitalsDraft | null | undefined,
  patch: Partial<KioskVitalsDraft>,
): KioskVitalsDraft {
  const merged: KioskVitalsDraft = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch) as [keyof KioskVitalsDraft, string | undefined | null][]) {
    if (value === null || value === "") {
      delete merged[key];
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  const bmi = computeBmiFromDraft(merged);
  if (bmi) merged.bmi = bmi;
  else delete merged.bmi;
  return merged;
}

export function isBloodPressureComplete(draft: KioskVitalsDraft) {
  return Boolean(draft.systolicPressure && draft.diastolicPressure);
}

export function isOxygenComplete(draft: KioskVitalsDraft) {
  return Boolean(draft.oxygenSaturation);
}

export function isWeightHeightComplete(draft: KioskVitalsDraft) {
  return Boolean(draft.weight && draft.height);
}

export function isTemperatureComplete(draft: KioskVitalsDraft) {
  return Boolean(draft.temperature);
}

export function isVitalsComplete(draft: KioskVitalsDraft) {
  return (
    isBloodPressureComplete(draft) &&
    isOxygenComplete(draft) &&
    isWeightHeightComplete(draft) &&
    isTemperatureComplete(draft)
  );
}
