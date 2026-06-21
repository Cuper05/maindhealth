"use client";

import { useActionState } from "react";
import {
  markPaymentPaid,
  upsertConsultationPayment,
} from "@/lib/actions/consultation-payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/db/schema/consultation-payments";
import { formatAmount } from "@/lib/format/money";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { inputClassName, labelClassName, cardClassName } from "@/lib/ui/classes";

type PaymentRow = {
  id: number;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  reference?: string | null;
  paidAt?: Date | null;
};

export function PaymentPanel({
  appointmentId,
  payment,
  canWrite,
}: {
  appointmentId: number;
  payment: PaymentRow | null;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(upsertConsultationPayment, null);
  const [paidState, paidAction, paidPending] = useActionState(markPaymentPaid, null);

  return (
    <section className={cardClassName}>
      <h2 className="mb-3 font-medium text-slate-900">Pago de consulta</h2>
      {payment ? (
        <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Monto</dt>
            <dd className="font-medium">{formatAmount(payment.amountCents, payment.currency)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Estatus</dt>
            <dd>{PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] ?? payment.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Método</dt>
            <dd>{PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}</dd>
          </div>
          {payment.paidAt && (
            <div>
              <dt className="text-slate-500">Pagado</dt>
              <dd>{payment.paidAt.toLocaleString("es-MX")}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mb-4 text-sm text-slate-600">Sin pago registrado para esta cita.</p>
      )}

      {canWrite && (
        <>
          <FormAlert
            error={state && !state.ok ? state.error : undefined}
            success={state?.ok ? "Pago actualizado" : undefined}
          />
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <div>
              <label className={labelClassName}>Monto (MXN)</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={payment ? payment.amountCents / 100 : 350}
                className={inputClassName}
                required
              />
            </div>
            <div>
              <label className={labelClassName}>Método</label>
              <select name="method" defaultValue={payment?.method ?? "pending"} className={inputClassName}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Estatus</label>
              <select name="status" defaultValue={payment?.status ?? "pending"} className={inputClassName}>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Referencia</label>
              <input name="reference" defaultValue={payment?.reference ?? ""} className={inputClassName} />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label={payment ? "Actualizar pago" : "Registrar pago"} pending={pending} />
            </div>
          </form>

          {payment && payment.status !== "paid" && (
            <form action={paidAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="paymentId" value={payment.id} />
              <div>
                <label className={labelClassName}>Marcar pagado — método</label>
                <select name="method" defaultValue="cash" className={inputClassName}>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div>
                <label className={labelClassName}>Referencia</label>
                <input name="reference" className={inputClassName} />
              </div>
              <SubmitButton label="Marcar pagado" pending={paidPending} />
              <FormAlert error={paidState && !paidState.ok ? paidState.error : undefined} />
            </form>
          )}
        </>
      )}
    </section>
  );
}
