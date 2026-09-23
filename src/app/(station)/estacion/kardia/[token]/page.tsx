import { KardiaUploadForm } from "@/components/station/kiosk/KardiaUploadForm";

export const dynamic = "force-dynamic";

export default async function EstacionKardiaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">ECG KardiaMobile</h1>
      <p className="mt-2 text-base text-slate-600">
        La app de AliveCor no se conecta sola a la estación. El puente es el PDF (o una
        foto) que Kardia ya sabe exportar.
      </p>
      <div className="mt-6">
        <KardiaUploadForm token={token} />
      </div>
    </main>
  );
}
