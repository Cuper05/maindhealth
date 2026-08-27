import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { consultationPaymentsTable } from "@/lib/db/schema";
import { confirmStationPayment } from "@/lib/kiosk/commerce";
import { getStripe } from "@/lib/payments/stripe";

async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  // Solo cumplir cuando el pago está realmente cobrado (sync o async).
  if (session.payment_status !== "paid") {
    return { skipped: true as const, reason: "not_paid" };
  }

  const kind = session.metadata?.kind;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;

  if (kind === "station_kiosk") {
    const paymentOrderId = Number(session.metadata?.paymentOrderId);
    const sessionToken = session.metadata?.sessionToken;
    if (!Number.isFinite(paymentOrderId) || !sessionToken) {
      return { skipped: true as const, reason: "missing_station_metadata" };
    }
    await confirmStationPayment({
      sessionToken,
      paymentOrderId,
      status: "approved",
      provider: "stripe",
      providerReference: paymentIntentId,
      providerPayload: {
        stripeCheckoutSessionId: session.id,
        source: "webhook",
      },
    });
    return { fulfilled: "station_kiosk" as const };
  }

  const paymentId = Number(session.metadata?.paymentId);
  if (!Number.isFinite(paymentId)) {
    return { skipped: true as const, reason: "missing_payment_id" };
  }

  await db
    .update(consultationPaymentsTable)
    .set({
      status: "paid",
      method: "stripe",
      paidAt: new Date(),
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      reference: paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(consultationPaymentsTable.id, paymentId));

  return { fulfilled: "portal_consultation" as const };
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    await fulfillCheckoutSession(session);
  }

  return NextResponse.json({ received: true });
}
