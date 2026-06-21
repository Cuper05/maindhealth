import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/db/schema/consultation-payments";
import { getPortalAppointment, getPaymentForAppointment } from "@/lib/queries/portal";
import { formatAmount } from "@/lib/format/money";
import { formatPersonName } from "@/lib/format/name";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalCitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isFinite(appointmentId)) notFound();

  const appointment = await getPortalAppointment(patientId, appointmentId);
  if (!appointment) notFound();

  const payment = await getPaymentForAppointment(appointmentId);

  return (
    <div>
      <PageHeader
        title="Detalle de cita"
        description={appointment.startAt.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" })}
        backHref="/portal/citas"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardClassName}>
          <h2 className="font-medium text-slate-900">Información</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Médico</dt>
              <dd>
                {formatPersonName({
                  firstName: appointment.doctorFirstName,
                  lastNamePaternal: appointment.doctorLastNamePaternal,
                  lastNameMaternal: appointment.doctorLastNameMaternal,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Estatus</dt>
              <dd>{appointment.statusName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Modalidad</dt>
              <dd className="capitalize">{appointment.modality}</dd>
            </div>
            {appointment.reason && (
              <div>
                <dt className="text-slate-500">Motivo</dt>
                <dd>{appointment.reason}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className={cardClassName}>
          <h2 className="font-medium text-slate-900">Pago</h2>
          {payment ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Monto</dt>
                <dd className="font-medium">{formatAmount(payment.amountCents, payment.currency)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Estatus</dt>
                <dd>{PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Método</dt>
                <dd>{PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sin cargo registrado.</p>
          )}
          <Link href="/portal/pagos" className="mt-4 inline-block text-sm text-teal-700 hover:underline">
            Ver todos los pagos →
          </Link>
        </section>
      </div>

      {appointment.meetingUrl && appointment.modality === "teleconsulta" && (
        <section className="mt-6">
          <DailyVideoRoom meetingUrl={appointment.meetingUrl} title="Unirse a la teleconsulta" />
        </section>
      )}
    </div>
  );
}
