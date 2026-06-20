export type VitalChartRecord = {
  id: number;
  recordedAt: string;
  systolicPressure: string | null;
  diastolicPressure: string | null;
  heartRate: string | null;
  oxygenSaturation: string | null;
  temperature: string | null;
  weight: string | null;
  glucose: string | null;
  bmi: string | null;
};

export type VitalMetricKey =
  | "pressure"
  | "heartRate"
  | "spo2"
  | "temperature"
  | "weight"
  | "glucose"
  | "bmi";

export type VitalRangeKey = "30" | "90" | "365" | "all";

export const VITAL_RANGE_LABELS: Record<VitalRangeKey, string> = {
  "30": "30 días",
  "90": "90 días",
  "365": "1 año",
  all: "Todo",
};

export const VITAL_METRICS: {
  key: VitalMetricKey;
  label: string;
  unit: string;
}[] = [
  { key: "pressure", label: "Presión arterial", unit: "mmHg" },
  { key: "heartRate", label: "Frecuencia cardiaca", unit: "lpm" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "temperature", label: "Temperatura", unit: "°C" },
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "glucose", label: "Glucosa", unit: "mg/dL" },
  { key: "bmi", label: "IMC", unit: "kg/m²" },
];

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number; date: Date; value: number }[];
};

function toNumber(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function filterVitalsByRange(
  records: VitalChartRecord[],
  range: VitalRangeKey,
) {
  if (range === "all") return records;

  const days = Number(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return records.filter((record) => new Date(record.recordedAt) >= cutoff);
}

export function buildChartSeries(
  records: VitalChartRecord[],
  metric: VitalMetricKey,
): ChartSeries[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );

  if (metric === "pressure") {
    return [
      seriesFromField(sorted, "systolicPressure", "Sistólica", "#0f766e"),
      seriesFromField(sorted, "diastolicPressure", "Diastólica", "#0891b2"),
    ].filter((series) => series.points.length > 0);
  }

  const fieldMap: Record<
    Exclude<VitalMetricKey, "pressure">,
    { field: keyof VitalChartRecord; color: string }
  > = {
    heartRate: { field: "heartRate", color: "#0f766e" },
    spo2: { field: "oxygenSaturation", color: "#059669" },
    temperature: { field: "temperature", color: "#d97706" },
    weight: { field: "weight", color: "#7c3aed" },
    glucose: { field: "glucose", color: "#dc2626" },
    bmi: { field: "bmi", color: "#2563eb" },
  };

  const config = fieldMap[metric];
  const metricMeta = VITAL_METRICS.find((item) => item.key === metric)!;
  const series = seriesFromField(sorted, config.field, metricMeta.label, config.color);
  return series.points.length > 0 ? [series] : [];
}

function seriesFromField(
  records: VitalChartRecord[],
  field: keyof VitalChartRecord,
  label: string,
  color: string,
): ChartSeries {
  const points = records
    .map((record) => {
      const value = toNumber(record[field] as string | null);
      if (value == null) return null;
      const date = new Date(record.recordedAt);
      return { x: date.getTime(), y: value, date, value };
    })
    .filter((point): point is NonNullable<typeof point> => point != null);

  return { id: field, label, color, points };
}

export function formatAxisDate(date: Date) {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
