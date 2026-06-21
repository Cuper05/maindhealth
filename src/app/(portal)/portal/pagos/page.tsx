import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/db/schema/consultation-payments";
import { getPortalPayments } from "@/lib/queries/portal";
import { formatAmount } from "@/lib/format/money";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalPagosPage() {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

  const payments = await getPortalPayments(patientId);

  return (
    <div>
      <PageHeader title="Mis pagos" description="Estado de pago por consulta." />
      <div className="space-y-3">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">Sin pagos registrados.</p>
        ) : (
          payments.map((p) => (
            <article key={p.id} className={cardClassName}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {formatAmount(p.amountCents, p.currency)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Cita {p.startAt.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{PAYMENT_STATUS_LABELS[p.status as PaymentStatus]}</p>
                  <p className="text-slate-500">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
