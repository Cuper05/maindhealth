import { NextResponse } from "next/server";
import { getAppOrigin, isStripeConfigured } from "@/lib/payments/stripe";

/**
 * Diagnóstico de cobro (sin secretos).
 * Útil para verificar configuración en local / producción antes de cobrar.
 */
export async function GET() {
  const origin = getAppOrigin();
  const stripeKey = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const keyPrefix = process.env.STRIPE_SECRET_KEY?.trim().slice(0, 7) ?? null;

  return NextResponse.json({
    ok: stripeKey && webhook && origin.startsWith("http"),
    stripe: {
      configured: isStripeConfigured(),
      secretKeyPresent: stripeKey,
      /** sk_test / sk_live — nunca el valor completo */
      mode:
        keyPrefix === "sk_test"
          ? "test"
          : keyPrefix === "sk_live"
            ? "live"
            : keyPrefix
              ? "unknown"
              : null,
      webhookSecretPresent: webhook,
    },
    appOrigin: origin,
    endpoints: {
      portalCheckout: "/api/payments/checkout",
      stationCheckout: "/api/station/payment/stripe",
      webhook: "/api/payments/webhook",
    },
    nextSteps: !stripeKey
      ? [
          "Crea cuenta en https://dashboard.stripe.com (modo Test).",
          "Copia Secret key (sk_test_…) → STRIPE_SECRET_KEY",
          "Crea webhook checkout.session.completed → STRIPE_WEBHOOK_SECRET",
          "Asegura NEXT_PUBLIC_APP_URL = URL pública HTTPS",
        ]
      : !webhook
        ? [
            "Falta STRIPE_WEBHOOK_SECRET: Dashboard → Developers → Webhooks → endpoint /api/payments/webhook",
          ]
        : [
            "Listo para probar: /estacion/paciente → Pagar con tarjeta (Stripe)",
            "Tarjeta test: 4242 4242 4242 4242, cualquier fecha futura, CVC 123",
          ],
  });
}
