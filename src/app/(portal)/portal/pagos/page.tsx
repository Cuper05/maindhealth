import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/db/schema/consultation-payments";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { getPortalPayments } from "@/lib/queries/portal";
import { formatAmount } from "@/lib/format/money";
import { StripePayButton } from "@/components/portal/StripePayButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalPagosPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

  const { paid, cancelled } = await searchParams;
  const payments = await getPortalPayments(patientId);
  const stripeEnabled = isStripeConfigured();

  return (
    <div>
      <PageHeader title="Mis pagos" description="Estado de pago por consulta." />
      {paid === "1" && (
        <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          Pago recibido. El estado se actualizará en unos segundos.
        </p>
      )}
      {cancelled === "1" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
        </p>
      )}
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
                    Cita{" "}
                    {p.startAt.toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{PAYMENT_STATUS_LABELS[p.status as PaymentStatus]}</p>
                  <p className="text-slate-500">
                    {PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}
                  </p>
                  {p.status === "pending" && stripeEnabled && (
                    <div className="mt-2">
                      <StripePayButton paymentId={p.id} />
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      {!stripeEnabled && payments.some((p) => p.status === "pending") && (
        <p className="mt-4 text-xs text-slate-500">
          Pagos en línea no configurados (STRIPE_SECRET_KEY).
        </p>
      )}
    </div>
  );
}
