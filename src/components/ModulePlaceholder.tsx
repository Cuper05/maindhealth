export function ModulePlaceholder({
  title,
  description,
  phase,
  tables,
}: {
  title: string;
  description: string;
  phase: 1 | 2 | 3;
  tables?: string[];
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-slate-600">{description}</p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-700">
          Fase {phase} — scaffold listo
        </p>
        <p className="mt-2 text-sm text-slate-500">
          La base de datos y la navegación ya están definidas. El formulario y
          flujo operativo se implementan en el siguiente sprint.
        </p>
        {tables && tables.length > 0 && (
          <ul className="mt-4 list-inside list-disc text-sm text-slate-600">
            {tables.map((table) => (
              <li key={table}>
                <code className="text-xs">{table}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
