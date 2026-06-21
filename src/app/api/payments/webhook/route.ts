import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consultationPaymentsTable } from "@/lib/db/schema";
import { getStripe } from "@/lib/payments/stripe";

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
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = Number(session.metadata?.paymentId);
    if (Number.isFinite(paymentId)) {
      await db
        .update(consultationPaymentsTable)
        .set({
          status: "paid",
          method: "stripe",
          paidAt: new Date(),
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          reference: session.payment_intent?.toString() ?? session.id,
          updatedAt: new Date(),
        })
        .where(eq(consultationPaymentsTable.id, paymentId));
    }
  }

  return NextResponse.json({ received: true });
}
