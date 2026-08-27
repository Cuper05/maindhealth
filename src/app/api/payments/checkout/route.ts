import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolvePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { consultationPaymentsTable } from "@/lib/db/schema";
import { getAppOrigin, getStripe, isStripeConfigured } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Pagos en línea no configurados. Agrega STRIPE_SECRET_KEY en .env" },
      { status: 503 },
    );
  }

  const session = await requireSession();
  if (!session?.userId || !session.role) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { paymentId?: number };
  const paymentId = Number(body.paymentId);
  if (!Number.isFinite(paymentId)) {
    return NextResponse.json({ error: "paymentId inválido" }, { status: 400 });
  }

  const [payment] = await db
    .select()
    .from(consultationPaymentsTable)
    .where(eq(consultationPaymentsTable.id, paymentId));

  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  if (session.role === "patient") {
    const patientId = await resolvePatientId(session);
    if (!patientId || patientId !== payment.patientId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
  }

  if (payment.status === "paid") {
    return NextResponse.json({ error: "Este pago ya fue completado" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no disponible" }, { status: 503 });
  }

  const origin = getAppOrigin();

  // Sin payment_method_types: métodos dinámicos desde el Dashboard de Stripe.
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency.toLowerCase(),
          unit_amount: payment.amountCents,
          product_data: {
            name: "Consulta MaindHealth",
            description: `Cita #${payment.appointmentId}`,
          },
        },
      },
    ],
    metadata: {
      kind: "portal_consultation",
      paymentId: String(payment.id),
      appointmentId: String(payment.appointmentId),
      patientId: String(payment.patientId),
    },
    success_url: `${origin}/portal/pagos?paid=1`,
    cancel_url: `${origin}/portal/pagos?cancelled=1`,
    locale: "es",
  });

  await db
    .update(consultationPaymentsTable)
    .set({
      stripeSessionId: checkoutSession.id,
      method: "stripe",
      updatedAt: new Date(),
    })
    .where(eq(consultationPaymentsTable.id, payment.id));

  return NextResponse.json({ url: checkoutSession.url });
}
