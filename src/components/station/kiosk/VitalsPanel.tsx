import type { VitalsDraft } from "./kiosk-api";

type Row = {
  id: string;
  label: string;
  value: string | null;
  icon: string;
};

function buildRows(draft: VitalsDraft): Row[] {
  return [
    {
      id: "pressure",
      label: "Presión arterial",
      value:
        draft.systolicPressure && draft.diastolicPressure
          ? `${draft.systolicPressure}/${draft.diastolicPressure} mmHg`
          : null,
      icon: "🫀",
    },
    {
      id: "heartRate",
      label: "Pulso",
      value: draft.heartRate ? `${draft.heartRate} lpm` : null,
      icon: "💓",
    },
    {
      id: "spo2",
      label: "Oxigenación",
      value: draft.oxygenSaturation ? `${draft.oxygenSaturation}%` : null,
      icon: "🫁",
    },
    {
      id: "weight",
      label: "Peso",
      value: draft.weight ? `${draft.weight} kg` : null,
      icon: "⚖️",
    },
    {
      id: "height",
      label: "Altura",
      value: draft.height ? `${draft.height} m` : null,
      icon: "📏",
    },
    {
      id: "bmi",
      label: "IMC",
      value: draft.bmi ?? null,
      icon: "📊",
    },
    {
      id: "temperature",
      label: "Temperatura",
      value: draft.temperature ? `${draft.temperature} °C` : null,
      icon: "🌡️",
    },
  ];
}

export function VitalsPanel({ draft }: { draft: VitalsDraft }) {
  const rows = buildRows(draft);
  const completed = rows.filter((r) => r.value).length;

  return (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(15,45,90,0.08)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#1a4d7c] to-[#1d6eb8] px-5 py-4 rounded-t-2xl">
        <h3 className="text-base font-semibold text-white">Tus resultados</h3>
        <p className="mt-0.5 text-xs text-blue-100">
          {completed} de {rows.length} mediciones
        </p>
      </div>
      <ul className="flex-1 space-y-1 p-3">
        {rows.map((row) => {
          const done = Boolean(row.value);
          return (
            <li
              key={row.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                done ? "bg-emerald-50/80" : "bg-slate-50/50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${
                  done ? "bg-white shadow-sm" : "bg-white/60 grayscale opacity-60"
                }`}
              >
                {row.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">{row.label}</p>
                <p
                  className={`truncate text-sm font-semibold ${
                    done ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {row.value ?? "Pendiente"}
                </p>
              </div>
              {done ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  ✓
                </span>
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-200" />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function VitalsSummaryGrid({ draft }: { draft: VitalsDraft }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {buildRows(draft).map((row) => (
        <div
          key={row.id}
          className={`rounded-xl border px-4 py-4 ${
            row.value ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100 bg-slate-50"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.label}</p>
          <p className={`mt-1 text-xl font-bold ${row.value ? "text-slate-900" : "text-slate-300"}`}>
            {row.value ?? "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
