import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import { getPortalPrescriptions } from "@/lib/queries/portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalRecetasPage() {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

  const prescriptions = await getPortalPrescriptions(patientId);

  return (
    <div>
      <PageHeader title="Mis recetas" description="Recetas emitidas en tus consultas." />
      <div className="space-y-4">
        {prescriptions.length === 0 ? (
          <p className="text-sm text-slate-500">Sin recetas.</p>
        ) : (
          prescriptions.map((rx) => (
            <article key={rx.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">Receta #{rx.id}</p>
                  <p className="text-sm text-slate-600">
                    {rx.issuedAt.toLocaleString("es-MX")} · Dr(a). {rx.doctorName}
                  </p>
                </div>
                <a
                  href={`/api/prescriptions/${rx.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-teal-700 hover:underline"
                >
                  Descargar PDF
                </a>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {rx.items.map((item) => (
                  <li key={item.id}>
                    {item.medication}
                    {item.dose ? ` — ${item.dose}` : ""}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
