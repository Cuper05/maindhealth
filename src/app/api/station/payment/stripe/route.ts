import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stationKioskSessionsTable, stationPaymentOrdersTable } from "@/lib/db/schema";
import { confirmStationPayment } from "@/lib/kiosk/commerce";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";
import { getAppOrigin, getStripe, isStripeConfigured } from "@/lib/payments/stripe";

type StripeOrderPayload = {
  stripeCheckoutSessionId?: unknown;
  stripeCheckoutUrl?: unknown;
  checkoutSessionIds?: unknown;
};

function checkoutIdsFromOrder(order: {
  providerReference?: string | null;
  providerPayload?: unknown;
}): string[] {
  const ids = new Set<string>();
  const payload = (order.providerPayload ?? {}) as StripeOrderPayload;
  if (
    typeof payload.stripeCheckoutSessionId === "string" &&
    payload.stripeCheckoutSessionId.startsWith("cs_")
  ) {
    ids.add(payload.stripeCheckoutSessionId);
  }
  if (Array.isArray(payload.checkoutSessionIds)) {
    for (const id of payload.checkoutSessionIds) {
      if (typeof id === "string" && id.startsWith("cs_")) ids.add(id);
    }
  }
  if (order.providerReference?.startsWith("cs_")) ids.add(order.providerReference);
  return [...ids];
}

function paymentIntentId(checkout: Stripe.Checkout.Session) {
  return typeof checkout.payment_intent === "string"
    ? checkout.payment_intent
    : checkout.payment_intent?.id ?? checkout.id;
}

async function confirmPaidCheckout(input: {
  cookieToken: string;
  paidCheckout: Stripe.Checkout.Session;
  paymentOrderId: number;
}) {
  const [cookieSession] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, input.cookieToken));
  const [order] = await db
    .select()
    .from(stationPaymentOrdersTable)
    .where(eq(stationPaymentOrdersTable.id, input.paymentOrderId));

  const metaToken = input.paidCheckout.metadata?.sessionToken;
  let sessionToken = input.cookieToken;
  if (order?.sessionId && cookieSession && order.sessionId !== cookieSession.id && metaToken) {
    sessionToken = metaToken;
  }

  const result = await confirmStationPayment({
    sessionToken,
    paymentOrderId: input.paymentOrderId,
    status: "approved",
    provider: "stripe",
    providerReference: input.paidCheckout.id,
    providerPayload: {
      stripeCheckoutSessionId: input.paidCheckout.id,
      stripePaymentIntentId: paymentIntentId(input.paidCheckout),
      stripePaymentStatus: input.paidCheckout.payment_status,
    },
  });

  if (result.ok && input.cookieToken !== sessionToken) {
    await db
      .update(stationKioskSessionsTable)
      .set({
        paymentOrderId: result.order.id,
        paymentStatus: "approved",
        currentStep: "identification",
        updatedAt: new Date(),
      })
      .where(eq(stationKioskSessionsTable.token, input.cookieToken));
  }

  return result;
}

function paidResponse(order: { id: number; reference: string; status: string }) {
  return NextResponse.json({
    paid: true,
    order: {
      id: order.id,
      reference: order.reference,
      status: order.status,
    },
    nextStep: "identification",
  });
}

/**
 * Crea Stripe Checkout para la orden de pago de la estación.
 * El paciente paga en el celular (QR) y el kiosco confirma por polling.
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

  const knownIds = checkoutIdsFromOrder(order);
  let openCheckout: Stripe.Checkout.Session | null = null;
  for (const id of knownIds) {
    const existing = await stripe.checkout.sessions.retrieve(id);
    if (existing.payment_status === "paid") {
      const result = await confirmPaidCheckout({
        cookieToken: cookie.token,
        paidCheckout: existing,
        paymentOrderId: order.id,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ alreadyPaid: true, url: null });
    }
    if (existing.status === "open" && existing.url && !openCheckout) {
      openCheckout = existing;
    }
  }

  if (openCheckout?.url) {
    return NextResponse.json({
      url: openCheckout.url,
      checkoutSessionId: openCheckout.id,
    });
  }

  const origin = getAppOrigin();
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
    success_url: `${origin}/estacion/pago-completado?stripe=success`,
    cancel_url: `${origin}/estacion/pago-completado?stripe=cancel`,
    locale: "es",
  });

  const checkoutSessionIds = [...new Set([...knownIds, checkout.id])];
  await db
    .update(stationPaymentOrdersTable)
    .set({
      provider: "stripe",
      providerReference: checkout.id,
      providerPayload: {
        stripeCheckoutSessionId: checkout.id,
        stripeCheckoutUrl: checkout.url,
        checkoutSessionIds,
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
 * El kiosco consulta este endpoint cada pocos segundos mientras muestra el QR.
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

  const [order] = await db
    .select()
    .from(stationPaymentOrdersTable)
    .where(eq(stationPaymentOrdersTable.id, paymentOrderId));

  if (order?.status === "approved") {
    const [cookieSession] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.token, cookie.token));
    if (cookieSession && cookieSession.paymentStatus !== "approved") {
      await db
        .update(stationKioskSessionsTable)
        .set({
          paymentOrderId: order.id,
          paymentStatus: "approved",
          currentStep: "identification",
          updatedAt: new Date(),
        })
        .where(eq(stationKioskSessionsTable.token, cookie.token));
    }
    return paidResponse(order);
  }

  let paidCheckout: Stripe.Checkout.Session | null =
    checkout.payment_status === "paid" ? checkout : null;

  if (!paidCheckout && order) {
    for (const id of checkoutIdsFromOrder(order)) {
      if (id === checkout.id) continue;
      const other = await stripe.checkout.sessions.retrieve(id);
      if (other.payment_status === "paid") {
        paidCheckout = other;
        break;
      }
    }
  }

  if (!paidCheckout) {
    return NextResponse.json({
      paid: false,
      paymentStatus: checkout.payment_status,
      status: checkout.status,
    });
  }

  const result = await confirmPaidCheckout({
    cookieToken: cookie.token,
    paidCheckout,
    paymentOrderId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return paidResponse(result.order);
}
