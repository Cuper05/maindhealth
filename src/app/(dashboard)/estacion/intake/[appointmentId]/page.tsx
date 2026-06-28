import { redirect } from "next/navigation";

export default async function EstacionIntakeRedirectPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  redirect(`/estacion/flujo?cita=${appointmentId}`);
}
