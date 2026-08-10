import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getTodayStationAppointments } from "@/lib/queries/visit-intake";
import { getWaitingDoctorStationSessions } from "@/lib/queries/station-waiting";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonPrimaryClassName, cardClassName } from "@/lib/ui/classes";

export default async function EstacionPage() {
  const session = await requireSession();
  if (!can(session?.role, "intake:view")) redirect("/");

  const appointments = await getTodayStationAppointments();
  const waitingDoctor = await getWaitingDoctorStationSessions();
  const pending = appointments.filter((a) => !a.intakeComplete).length;

  return (
    <div>
      <PageHeader
        title="Estación de telemedicina"
        description="Deja esta pestaña abierta en la Dell al inicio del día (sesión iniciada). El video del paciente se abre solo tras escalación IA — no uses Agenda en esta PC."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href="https://health.maindsteel.com.mx/estacion/paciente?nueva=1"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[#1d6eb8] bg-[#f0f7ff] px-4 py-2 text-sm font-medium text-[#1a4d7c] hover:bg-[#e0efff]"
            >
              Kiosk táctil (datos / signos)
            </a>
            {session?.role && can(session.role, "intake:write") ? (
              <Link href="/estacion/flujo" className={buttonPrimaryClassName}>
                Iniciar protocolo staff
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 rounded-xl border-2 border-[#1d6eb8] bg-[#f0f7ff] px-4 py-4 text-sm text-[#0f3d66]">
        <p className="font-semibold text-base">Operación Dell — video automático</p>
        <p className="mt-1">
          Al abrir esta página se activa el <strong>modo estación</strong> en este navegador. Aunque
          alguien navegue a Agenda por error, la Dell sigue vigilando la cola y abre{" "}
          <code className="rounded bg-white/80 px-1">/estacion/sala/…</code> sola (≤2 s). El kiosk
          táctil solo captura datos; el médico remoto se une por notificación.
        </p>
      </div>

      {waitingDoctor.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Paciente en espera — apertura automática</p>
            <p className="mt-1">
              La videoconsulta debe abrirse sola en esta PC. Si no aparece el overlay, usa el botón
              grande abajo. No abras Agenda para unir al paciente.
            </p>
          </div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Pacientes esperando teleconsulta ({waitingDoctor.length})
          </h2>
          <div className="space-y-3">
            {waitingDoctor.map((item) => (
              <article
                key={item.sessionId}
                className={`${cardClassName} border-amber-200 bg-amber-50/40`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {item.patientName}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        ({item.chartNumber})
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Asignado a Dr(a). {item.doctorName} · {item.modality}
                    </p>
                    {item.summary && (
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{item.summary}</p>
                    )}
                    {item.redFlags.length > 0 && (
                      <p className="mt-2 text-xs font-medium text-amber-800">
                        {item.redFlags.slice(0, 3).join(" · ")}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {item.meetingUrl
                        ? "Sala Daily lista — se abre automáticamente en esta PC."
                        : "Sala Daily pendiente — se creará al entrar (revisa VIDEO_API_KEY si falla)."}
                    </p>
                  </div>
                  <div className="flex flex-col flex-wrap gap-2 sm:items-end">
                    <Link
                      href={`/estacion/sala/${item.appointmentId}`}
                      className={`${buttonPrimaryClassName} text-center`}
                    >
                      Abrir videoconsulta ahora
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/consultas/cita/${item.appointmentId}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Expediente / médico remoto
                      </Link>
                      <Link
                        href={`/agenda/${item.appointmentId}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Ver cita
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Citas hoy" value={appointments.length} />
        <StatCard label="Intake pendiente" value={pending} highlight={pending > 0} />
        <StatCard
          label="Esperando médico"
          value={waitingDoctor.length}
          highlight={waitingDoctor.length > 0}
        />
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
