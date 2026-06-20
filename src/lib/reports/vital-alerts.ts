export type VitalAlert = {
  metric: string;
  value: string;
  note: string;
};

type VitalFields = {
  systolicPressure: string | null;
  diastolicPressure: string | null;
  heartRate: string | null;
  oxygenSaturation: string | null;
  temperature: string | null;
  glucose: string | null;
};

function toNumber(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getVitalAlerts(vital: VitalFields): VitalAlert[] {
  const alerts: VitalAlert[] = [];
  const systolic = toNumber(vital.systolicPressure);
  if (systolic != null) {
    if (systolic < 90) alerts.push({ metric: "Sistólica", value: `${systolic}`, note: "Hipotensión" });
    else if (systolic > 140) alerts.push({ metric: "Sistólica", value: `${systolic}`, note: "Hipertensión" });
  }
  const diastolic = toNumber(vital.diastolicPressure);
  if (diastolic != null) {
    if (diastolic < 60) alerts.push({ metric: "Diastólica", value: `${diastolic}`, note: "Hipotensión" });
    else if (diastolic > 90) alerts.push({ metric: "Diastólica", value: `${diastolic}`, note: "Hipertensión" });
  }
  const heartRate = toNumber(vital.heartRate);
  if (heartRate != null) {
    if (heartRate < 60) alerts.push({ metric: "FC", value: `${heartRate}`, note: "Bradicardia" });
    else if (heartRate > 100) alerts.push({ metric: "FC", value: `${heartRate}`, note: "Taquicardia" });
  }
  const spo2 = toNumber(vital.oxygenSaturation);
  if (spo2 != null && spo2 < 94) alerts.push({ metric: "SpO₂", value: `${spo2}%`, note: "Hipoxemia" });
  const temperature = toNumber(vital.temperature);
  if (temperature != null) {
    if (temperature < 36) alerts.push({ metric: "Temp.", value: `${temperature}°C`, note: "Hipotermia" });
    else if (temperature > 37.5) alerts.push({ metric: "Temp.", value: `${temperature}°C`, note: "Fiebre" });
  }
  const glucose = toNumber(vital.glucose);
  if (glucose != null) {
    if (glucose < 70) alerts.push({ metric: "Glucosa", value: `${glucose}`, note: "Hipoglucemia" });
    else if (glucose > 140) alerts.push({ metric: "Glucosa", value: `${glucose}`, note: "Hiperglucemia" });
  }
  return alerts;
}

export function hasVitalAlerts(vital: VitalFields): boolean {
  return getVitalAlerts(vital).length > 0;
}
