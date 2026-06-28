import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getTodayStationAppointments } from "@/lib/queries/visit-intake";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName, cardClassName } from "@/lib/ui/classes";

export default async function EstacionPage() {
  const session = await requireSession();
  if (!can(session?.role, "intake:view")) redirect("/");

  const appointments = await getTodayStationAppointments();
  const pending = appointments.filter((a) => !a.intakeComplete).length;

  return (
    <div>
      <PageHeader
        title="Estación de telemedicina"
        description="Panel del día y acceso al protocolo guiado de llegada."
        action={
          session?.role && can(session.role, "intake:write") ? (
            <Link href="/estacion/flujo" className={buttonPrimaryClassName}>
              Iniciar protocolo
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Citas hoy" value={appointments.length} />
        <StatCard label="Intake pendiente" value={pending} highlight={pending > 0} />
        <StatCard label="Listos para triage" value={appointments.length - pending} />
      </div>

      <div className="space-y-3">
        {appointments.length === 0 ? (
          <p className="text-sm text-slate-500">No hay citas programadas para hoy.</p>
        ) : (
          appointments.map((appt) => (
            <article key={appt.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {appt.patientName}{" "}
                    <span className="text-sm font-normal text-slate-500">({appt.chartNumber})</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {appt.startAt.toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Dr(a). {appt.doctorName} · {appt.modality}
                  </p>
                  {appt.reason && <p className="mt-1 text-sm text-slate-500">{appt.reason}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {appt.intakeComplete ? (
                    <>
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                        Intake completo
                      </span>
                      <Link
                        href={`/triage/nuevo?patientId=${appt.patientId}&appointmentId=${appt.id}&redirect=/agenda/${appt.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Triage
                      </Link>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Intake pendiente
                      </span>
                      {session?.role && can(session.role, "intake:write") && (
                        <Link
                          href={`/estacion/flujo?cita=${appt.id}`}
                          className={buttonPrimaryClassName}
                        >
                          Iniciar protocolo
                        </Link>
                      )}
                    </>
                  )}
                  <Link
                    href={`/agenda/${appt.id}`}
                    className="text-sm text-teal-700 hover:underline"
                  >
                    Ver cita
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={cardClassName}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}
