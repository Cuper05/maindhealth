export type ReportPeriodDays = 7 | 30 | 90;

export const REPORT_PERIOD_OPTIONS: { days: ReportPeriodDays; label: string }[] = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

export function parseReportPeriod(value: string | undefined): ReportPeriodDays {
  if (value === "7") return 7;
  if (value === "90") return 90;
  return 30;
}

export function getPeriodStart(days: ReportPeriodDays): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start;
}

export function formatReportPeriodLabel(days: ReportPeriodDays): string {
  return REPORT_PERIOD_OPTIONS.find((option) => option.days === days)?.label ?? `${days} días`;
}
