import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  formatAlertPatient,
  formatAlertSeverity,
  getClinicalAlertsList,
} from "@/lib/queries/clinical-alerts";
import { AcknowledgeAlertButton } from "@/components/forms/AcknowledgeAlertButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ todas?: string }>;
}) {
  const session = await requireSession();
  if (!can(session?.role, "alerts:view")) redirect("/");

  const { todas } = await searchParams;
  const showAll = todas === "1";
  const alerts = await getClinicalAlertsList(!showAll);

  return (
    <div>
      <PageHeader
        title="Alertas clínicas"
        description="Signos vitales y lecturas de equipos fuera de rango."
        action={
          showAll ? (
            <Link href="/alertas" className="text-sm font-medium text-teal-700 hover:underline">
              Solo pendientes
            </Link>
          ) : (
            <Link href="/alertas?todas=1" className="text-sm font-medium text-teal-700 hover:underline">
              Ver atendidas
            </Link>
          )
        }
      />
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">
            {showAll ? "Sin alertas registradas." : "No hay alertas pendientes."}
          </p>
        ) : (
          alerts.map((alert) => (
            <article key={alert.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    <Link href={`/pacientes/${alert.patientId}`} className="text-teal-700 hover:underline">
                      {formatAlertPatient(alert)}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{alert.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatAlertSeverity(alert.severity)} · {alert.metric}
                    {alert.value ? ` · ${alert.value}` : ""} · {alert.source} ·{" "}
                    {alert.createdAt.toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {alert.acknowledgedAt && (
                    <p className="mt-1 text-xs text-teal-700">
                      Atendida{" "}
                      {alert.acknowledgedAt.toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
                {!alert.acknowledgedAt && session?.role && can(session.role, "alerts:write") && (
                  <AcknowledgeAlertButton alertId={alert.id} />
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
