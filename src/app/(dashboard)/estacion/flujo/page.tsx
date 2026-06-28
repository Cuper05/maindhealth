import { redirect } from "next/navigation";
import { Suspense } from "react";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getActiveDoctors } from "@/lib/queries/catalogs";
import { getTodayStationAppointments } from "@/lib/queries/visit-intake";
import { StationFlowWizard } from "@/components/station/StationFlowWizard";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function EstacionFlujoPage() {
  const session = await requireSession();
  if (!can(session?.role, "intake:write")) redirect("/estacion");

  const [appointments, doctors] = await Promise.all([
    getTodayStationAppointments(),
    getActiveDoctors(),
  ]);

  const today = appointments.map((a) => ({
    id: a.id,
    patientId: a.patientId,
    patientName: a.patientName,
    chartNumber: a.chartNumber,
    startAt: a.startAt.toISOString(),
    doctorName: a.doctorName,
    modality: a.modality,
    reason: a.reason,
    hasVitals: a.hasVitals,
    intakeComplete: a.intakeComplete,
  }));

  return (
    <div>
      <PageHeader
        title="Protocolo de estación"
        description="Bienvenida → paciente → datos → clínico → consentimiento → signos → espera."
        backHref="/estacion"
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <StationFlowWizard todayAppointments={today} doctors={doctors} />
      </Suspense>
    </div>
  );
}
