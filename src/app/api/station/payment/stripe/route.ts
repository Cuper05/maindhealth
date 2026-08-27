import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stationKioskSessionsTable, stationPaymentOrdersTable } from "@/lib/db/schema";
import { confirmStationPayment } from "@/lib/kiosk/commerce";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { getAppOrigin, getStripe, isStripeConfigured } from "@/lib/payments/stripe";

/**
 * Crea Stripe Checkout para la orden de pago de la estación.
 * El paciente paga en la pantalla táctil (tarjeta) y vuelve al kiosco.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe no configurado. Agrega STRIPE_SECRET_KEY en el servidor." },
      { status: 503 },
    );
  }

  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión de estación" }, { status: 400 });
  }

  const body = (await request.json()) as { paymentOrderId?: number; customerEmail?: string };
  const paymentOrderId = Number(body.paymentOrderId);
  if (!Number.isFinite(paymentOrderId)) {
    return NextResponse.json({ error: "paymentOrderId inválido" }, { status: 400 });
  }

  const rawEmail = (body.customerEmail ?? process.env.STRIPE_KIOSK_RECEIPT_EMAIL ?? "recibos@maindsteel.com.mx")
    .trim()
    .toLowerCase();
  const customerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
    ? rawEmail
    : "recibos@maindsteel.com.mx";

  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, cookie.token));
  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const [order] = await db
    .select()
    .from(stationPaymentOrdersTable)
    .where(eq(stationPaymentOrdersTable.id, paymentOrderId));
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (order.sessionId && order.sessionId !== session.id) {
    return NextResponse.json({ error: "La orden no pertenece a esta sesión" }, { status: 403 });
  }
  if (order.status === "approved") {
    return NextResponse.json({ alreadyPaid: true, url: null });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no disponible" }, { status: 503 });
  }

  const origin = getAppOrigin();
  // Sin payment_method_types: Stripe muestra métodos dinámicos del Dashboard (best practice).
  // customer_email prellenado: en kiosco táctil no hay teclado en la página de Stripe.
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (order.currency || "MXN").toLowerCase(),
          unit_amount: order.amountCents,
          product_data: {
            name: order.concept || "Consulta MaindHealth",
            description: `Ref. ${order.reference}`,
          },
        },
      },
    ],
    metadata: {
      kind: "station_kiosk",
      paymentOrderId: String(order.id),
      sessionToken: cookie.token,
      reference: order.reference,
      customerEmail,
    },
    client_reference_id: order.reference,
    // El paciente paga en el celular (QR). El kiosco hace polling; el móvil solo ve confirmación.
    success_url: `${origin}/estacion/pago-completado?stripe=success`,
    cancel_url: `${origin}/estacion/pago-completado?stripe=cancel`,
    locale: "es",
  });

  await db
    .update(stationPaymentOrdersTable)
    .set({
      provider: "stripe",
      providerReference: checkout.id,
      providerPayload: {
        stripeCheckoutSessionId: checkout.id,
        stripeCheckoutUrl: checkout.url,
      },
      updatedAt: new Date(),
    })
    .where(eq(stationPaymentOrdersTable.id, order.id));

  return NextResponse.json({
    url: checkout.url,
    checkoutSessionId: checkout.id,
  });
}

/**
 * Tras volver de Stripe: verifica el Checkout Session y aprueba la orden en estación.
 */
export async function GET(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión de estación" }, { status: 400 });
  }

  const checkoutSessionId = new URL(request.url).searchParams.get("session_id");
  if (!checkoutSessionId) {
    return NextResponse.json({ error: "session_id requerido" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no disponible" }, { status: 503 });
  }

  const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const paymentOrderId = Number(checkout.metadata?.paymentOrderId);
  if (!Number.isFinite(paymentOrderId)) {
    return NextResponse.json({ error: "Checkout sin orden de estación" }, { status: 400 });
  }

  if (checkout.payment_status !== "paid" && checkout.status !== "complete") {
    return NextResponse.json({
      paid: false,
      paymentStatus: checkout.payment_status,
      status: checkout.status,
    });
  }

  const result = await confirmStationPayment({
    sessionToken: cookie.token,
    paymentOrderId,
    status: "approved",
    provider: "stripe",
    providerReference:
      typeof checkout.payment_intent === "string"
        ? checkout.payment_intent
        : checkout.payment_intent?.id ?? checkout.id,
    providerPayload: {
      stripeCheckoutSessionId: checkout.id,
      stripePaymentStatus: checkout.payment_status,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    paid: true,
    order: {
      id: result.order.id,
      reference: result.order.reference,
      status: result.order.status,
    },
    nextStep: "identification",
  });
}
