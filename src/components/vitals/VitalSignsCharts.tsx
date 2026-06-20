"use client";

import { useMemo, useState } from "react";
import {
  buildChartSeries,
  filterVitalsByRange,
  formatAxisDate,
  VITAL_METRICS,
  VITAL_RANGE_LABELS,
  type ChartSeries,
  type VitalChartRecord,
  type VitalMetricKey,
  type VitalRangeKey,
} from "@/lib/vitals/chart-metrics";
import { cardClassName } from "@/lib/ui/classes";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 36, left: 48 };

export function VitalSignsCharts({ records }: { records: VitalChartRecord[] }) {
  const [metric, setMetric] = useState<VitalMetricKey>("pressure");
  const [range, setRange] = useState<VitalRangeKey>("90");

  const filtered = useMemo(
    () => filterVitalsByRange(records, range),
    [records, range],
  );
  const series = useMemo(
    () => buildChartSeries(filtered, metric),
    [filtered, metric],
  );
  const unit = VITAL_METRICS.find((item) => item.key === metric)?.unit ?? "";

  return (
    <section className={`${cardClassName} mb-6 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Historial gráfico</h2>
          <p className="mt-1 text-sm text-slate-600">
            Evolución de signos vitales en el tiempo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VITAL_RANGE_LABELS) as VitalRangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                range === key
                  ? "bg-teal-50 font-medium text-teal-800"
                  : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {VITAL_RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {VITAL_METRICS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setMetric(item.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              metric === item.key
                ? "bg-teal-700 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {series.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          Sin datos para esta métrica en el rango seleccionado.
        </p>
      ) : (
        <>
          <VitalLineChart series={series} unit={unit} />
          <div className="flex flex-wrap gap-4 text-sm">
            {series.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-2 text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
            <span className="text-slate-400">Unidad: {unit}</span>
          </div>
        </>
      )}
    </section>
  );
}

function VitalLineChart({ series, unit }: { series: ChartSeries[]; unit: string }) {
  const allPoints = series.flatMap((item) => item.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const yPad = (maxY - minY || 1) * 0.1;
  const plotMinY = minY - yPad;
  const plotMaxY = maxY + yPad;

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const scaleX = (value: number) =>
    PADDING.left + ((value - minX) / (maxX - minX || 1)) * innerWidth;
  const scaleY = (value: number) =>
    PADDING.top + innerHeight - ((value - plotMinY) / (plotMaxY - plotMinY || 1)) * innerHeight;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, index) =>
    plotMinY + ((plotMaxY - plotMinY) * index) / yTicks,
  );

  const xLabels = [
    allPoints[0]?.date,
    allPoints[Math.floor(allPoints.length / 2)]?.date,
    allPoints[allPoints.length - 1]?.date,
  ].filter(Boolean) as Date[];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="min-w-full max-w-full rounded-lg bg-slate-50 ring-1 ring-slate-100"
        role="img"
        aria-label={`Gráfica de signos vitales en ${unit}`}
      >
        {tickValues.map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text x={8} y={y + 4} fill="#64748b" fontSize={11}>
                {tick.toFixed(tick >= 10 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        {series.map((item) => {
          const path = item.points
            .map((point, index) => {
              const cmd = index === 0 ? "M" : "L";
              return `${cmd}${scaleX(point.x)},${scaleY(point.y)}`;
            })
            .join(" ");

          return (
            <g key={item.id}>
              <path d={path} fill="none" stroke={item.color} strokeWidth={2.5} />
              {item.points.map((point) => (
                <circle
                  key={`${item.id}-${point.x}`}
                  cx={scaleX(point.x)}
                  cy={scaleY(point.y)}
                  r={4}
                  fill={item.color}
                >
                  <title>
                    {item.label}: {point.value} {unit} · {point.date.toLocaleString("es-MX")}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}

        {xLabels.map((date, index) => (
          <text
            key={`${date.toISOString()}-${index}`}
            x={scaleX(date.getTime())}
            y={CHART_HEIGHT - 10}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
          >
            {formatAxisDate(date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
