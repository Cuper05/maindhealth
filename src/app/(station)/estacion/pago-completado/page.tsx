import { BrandLogo } from "@/components/BrandLogo";

/** Página corta para el celular tras pagar (el kiosco detecta el pago solo). */
export default async function PagoCompletadoPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const params = await searchParams;
  const cancelled = params.stripe === "cancel";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#eef5fc] to-white px-6 py-12 text-center">
      <BrandLogo className="h-12 w-auto" />
      <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900">
        {cancelled ? "Pago cancelado" : "Pago recibido"}
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600">
        {cancelled
          ? "Puede cerrar esta ventana y volver a intentar en la estación, o pedir ayuda al personal."
          : "Ya puede cerrar esta ventana y continuar en la pantalla táctil de la estación."}
      </p>
    </main>
  );
}
