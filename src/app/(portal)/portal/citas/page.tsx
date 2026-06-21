import Link from "next/link";
import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import { getPortalAppointments } from "@/lib/queries/portal";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalCitasPage() {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

  const appointments = await getPortalAppointments(patientId);

  return (
    <div>
      <PageHeader title="Mis citas" description="Consultas programadas y videollamadas." />
      <div className="space-y-3">
        {appointments.length === 0 ? (
          <p className="text-sm text-slate-500">Sin citas registradas.</p>
        ) : (
          appointments.map((a) => (
            <Link
              key={a.id}
              href={`/portal/citas/${a.id}`}
              className={`block ${cardClassName} hover:border-teal-200`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {a.startAt.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" })}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Dr(a). {formatPersonName({
                      firstName: a.doctorFirstName,
                      lastNamePaternal: a.doctorLastNamePaternal,
                      lastNameMaternal: a.doctorLastNameMaternal,
                    })} · {a.typeName ?? a.modality} · {a.statusName}
                  </p>
                  {a.reason && <p className="mt-1 text-sm text-slate-500">{a.reason}</p>}
                </div>
                {a.meetingUrl && a.modality === "teleconsulta" && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                    Videollamada
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
