import { z } from "zod";

export const paymentSchema = z.object({
  appointmentId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("Monto inválido"),
  method: z.enum(["pending", "cash", "card", "transfer"]),
  status: z.enum(["pending", "paid", "cancelled", "refunded"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export function parsePaymentForm(formData: FormData) {
  return paymentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    status: formData.get("status"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export function parseMarkPaidForm(formData: FormData) {
  return z
    .object({
      paymentId: z.coerce.number().int().positive(),
      method: z.enum(["cash", "card", "transfer"]),
      reference: z.string().optional(),
    })
    .safeParse({
      paymentId: formData.get("paymentId"),
      method: formData.get("method"),
      reference: formData.get("reference") || undefined,
    });
}
