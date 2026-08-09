import { NextResponse } from "next/server";
import {
  confirmStationPayment,
  createStationPaymentOrder,
  newDemoProviderReference,
} from "@/lib/kiosk/commerce";
import { getKioskCookie } from "@/lib/kiosk/session-cookie";

export async function POST(request: Request) {
  try {
    const cookie = await getKioskCookie();
    if (!cookie.token) {
      return NextResponse.json({ error: "Sin sesión de estación" }, { status: 400 });
    }

    const body = await request.json();
    const serviceId = Number(body.serviceId);
    if (!Number.isFinite(serviceId)) {
      return NextResponse.json({ error: "Servicio no válido" }, { status: 400 });
    }

    const result = await createStationPaymentOrder({
      sessionToken: cookie.token,
      serviceId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      order: {
        id: result.order.id,
        reference: result.order.reference,
        amountCents: result.order.amountCents,
        currency: result.order.currency,
        concept: result.order.concept,
        status: result.order.status,
        provider: result.order.provider,
      },
      service: {
        id: result.service.id,
        name: result.service.name,
        description: result.service.description,
        amountCents: result.service.amountCents,
        currency: result.service.currency,
      },
    });
  } catch (error) {
    console.error("station/payment POST", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al crear el cobro" },
      { status: 500 },
    );
  }
}

/** Confirma resultado del terminal (Nayax) o simulación demo. */
export async function PATCH(request: Request) {
  const cookie = await getKioskCookie();
  if (!cookie.token) {
    return NextResponse.json({ error: "Sin sesión de estación" }, { status: 400 });
  }

  const body = await request.json();
  const paymentOrderId = Number(body.paymentOrderId);
  const status = body.status as "approved" | "rejected" | "cancelled" | "error";
  if (!Number.isFinite(paymentOrderId) || !["approved", "rejected", "cancelled", "error"].includes(status)) {
    return NextResponse.json({ error: "Datos de pago inválidos" }, { status: 400 });
  }

  const result = await confirmStationPayment({
    sessionToken: cookie.token,
    paymentOrderId,
    status,
    provider: body.provider ?? "demo",
    providerReference: body.providerReference ?? (status === "approved" ? newDemoProviderReference() : undefined),
    providerPayload: body.providerPayload,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    order: {
      id: result.order.id,
      reference: result.order.reference,
      status: result.order.status,
      approvedAt: result.order.approvedAt,
      providerReference: result.order.providerReference,
    },
    nextStep: result.order.status === "approved" ? "identification" : "payment",
  });
}
