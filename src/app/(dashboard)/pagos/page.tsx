import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/db/schema/consultation-payments";
import { getPaymentsList, formatPaymentPatientName } from "@/lib/queries/payments";
import { formatAmount } from "@/lib/format/money";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PagosPage() {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "payments:view")) redirect("/");

  const rows = await getPaymentsList();

  return (
    <div>
      <PageHeader
        title="Pagos de consulta"
        description="Cobros registrados por cita. Gestiona el detalle desde la agenda."
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Cita</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 font-medium">Método</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">
                  Sin pagos registrados.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {row.startAt.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    {row.chartNumber} — {formatPaymentPatientName(row)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatAmount(row.amountCents, row.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {PAYMENT_STATUS_LABELS[row.status as PaymentStatus]}
                  </td>
                  <td className="px-4 py-3">
                    {PAYMENT_METHOD_LABELS[row.method as PaymentMethod]}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/agenda/${row.appointmentId}`} className="text-teal-700 hover:underline">
                      Ver cita
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
