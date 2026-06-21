import Link from "next/link";
import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import { getPortalAppointments, getPatientSummary, getPortalPayments } from "@/lib/queries/portal";
import { formatAmount } from "@/lib/format/money";
import { cardClassName } from "@/lib/ui/classes";
import { formatPersonName } from "@/lib/format/name";

export default async function PortalHomePage() {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) {
    return <p className="text-sm text-red-600">Tu cuenta no está vinculada a un expediente.</p>;
  }

  const [patient, appointments, payments] = await Promise.all([
    getPatientSummary(patientId),
    getPortalAppointments(patientId),
    getPortalPayments(patientId),
  ]);

  const upcoming = appointments.filter((a) => a.startAt >= new Date()).slice(0, 3);
  const pendingPayments = payments.filter((p) => p.status === "pending").length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Hola, {patient ? formatPersonName(patient) : session?.name}
      </h1>
      <p className="mt-1 text-slate-600">
        Expediente {patient?.chartNumber ?? "—"} · Teleconsultorio MaindHealth
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard href="/portal/citas" label="Próximas citas" value={upcoming.length} />
        <StatCard href="/portal/pagos" label="Pagos pendientes" value={pendingPayments} highlight={pendingPayments > 0} />
        <StatCard href="/portal/recetas" label="Citas totales" value={appointments.length} />
      </div>

      <section className={`${cardClassName} mt-8`}>
        <h2 className="font-medium text-slate-900">Próximas citas</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No tienes citas programadas.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                <div>
                  <p className="font-medium text-slate-900">
                    {a.startAt.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {formatPersonName({
                      firstName: a.doctorFirstName,
                      lastNamePaternal: a.doctorLastNamePaternal,
                      lastNameMaternal: a.doctorLastNameMaternal,
                    })} · {a.statusName}
                  </p>
                </div>
                <Link href={`/portal/citas/${a.id}`} className="text-sm font-medium text-teal-700 hover:underline">
                  Ver detalle →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingPayments > 0 && (
        <section className={`${cardClassName} mt-6 border-amber-200 bg-amber-50/50`}>
          <h2 className="font-medium text-amber-900">Pagos pendientes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {payments
              .filter((p) => p.status === "pending")
              .slice(0, 3)
              .map((p) => (
                <li key={p.id}>
                  Cita {p.startAt.toLocaleDateString("es-MX")} — {formatAmount(p.amountCents, p.currency)}
                </li>
              ))}
          </ul>
          <Link href="/portal/pagos" className="mt-3 inline-block text-sm font-medium text-teal-700">
            Ver pagos →
          </Link>
        </section>
      )}
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  highlight,
}: {
  href: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-5 shadow-sm transition hover:shadow ${highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
