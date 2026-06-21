import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getOperationalReport } from "@/lib/queries/reports";
import { formatReportPeriodLabel, parseReportPeriod, REPORT_PERIOD_OPTIONS } from "@/lib/reports/period";
import { cardClassName } from "@/lib/ui/classes";

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "reports:view")) redirect("/");
  const { periodo } = await searchParams;
  const periodDays = parseReportPeriod(periodo);
  const report = await getOperationalReport(periodDays);
  const periodLabel = formatReportPeriodLabel(periodDays);
  const maxAppt = Math.max(...report.appointmentsByStatus.map((r) => r.total), 1);
  const maxAct = Math.max(...report.activityByModule.map((r) => r.total), 1);
  return (
    <div>
      <PageHeader title="Reportes operativos" description={`Indicadores clínicos y de productividad — últimos ${periodLabel.toLowerCase()}.`} />
      <div className="mb-6 flex flex-wrap gap-2">{REPORT_PERIOD_OPTIONS.map((o) => (<PeriodLink key={o.days} href={`/reportes?periodo=${o.days}`} label={o.label} active={periodDays === o.days} />))}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Pacientes nuevos" value={report.summary.newPatients} />
        <MetricCard label="Citas" value={report.summary.appointments} href="/agenda" />
        <MetricCard label="Consultas" value={report.summary.consultations} href="/consultas" />
        <MetricCard label="Recetas emitidas" value={report.summary.prescriptions} href="/recetas" />
        <MetricCard label="Seguimientos" value={report.summary.followUps} href="/seguimientos" />
        <MetricCard label="Capturas de triage" value={report.summary.vitalCaptures} href="/triage" />
        <MetricCard label="Signos fuera de rango" value={report.summary.outOfRangeVitals} href="/triage/historial" highlight={report.summary.outOfRangeVitals > 0} />
        <MetricCard label="Lecturas de equipos" value={report.summary.deviceReadings} href="/dispositivos" />
        <MetricCard label="Resultados lab." value={report.summary.labResults} href="/laboratorio" />
        <MetricCard label="Pagos cobrados" value={report.summary.paymentsPaid} href="/pagos" />
        <MetricCard label="Firmas digitales" value={report.summary.digitalSignatures} />
        <MetricCard label="Teleconsultas" value={report.summary.teleconsultas} href="/agenda" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className={cardClassName}><h2 className="font-medium text-slate-900">Citas por estatus</h2><p className="mt-1 text-sm text-slate-500">Distribución en el periodo.</p>{report.appointmentsByStatus.length === 0 ? <p className="mt-4 text-sm text-slate-500">Sin citas.</p> : <ul className="mt-4 space-y-3">{report.appointmentsByStatus.map((row) => (<li key={row.statusName}><div className="mb-1 flex justify-between text-sm"><span>{row.statusName}</span><span className="font-medium">{row.total}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${(row.total / maxAppt) * 100}%` }} /></div></li>))}</ul>}</section>
        <section className={cardClassName}><h2 className="font-medium text-slate-900">Productividad médica</h2>{report.doctorProductivity.length === 0 ? <p className="mt-4 text-sm text-slate-500">Sin actividad.</p> : <table className="mt-4 w-full text-sm"><thead><tr className="text-slate-500"><th className="pb-2 text-left">Médico</th><th className="pb-2 text-right">Consultas</th><th className="pb-2 text-right">Recetas</th></tr></thead><tbody>{report.doctorProductivity.map((row) => (<tr key={row.doctorName} className="border-t"><td className="py-2">{row.doctorName}</td><td className="py-2 text-right font-medium">{row.consultations}</td><td className="py-2 text-right">{row.prescriptions}</td></tr>))}</tbody></table>}</section>
        <section className={cardClassName}><h2 className="font-medium text-slate-900">Actividad del sistema</h2>{report.activityByModule.length === 0 ? <p className="mt-4 text-sm text-slate-500">Sin eventos.</p> : <ul className="mt-4 space-y-3">{report.activityByModule.map((row) => (<li key={row.module}><div className="mb-1 flex justify-between text-sm"><span>{row.moduleLabel}</span><span className="font-medium">{row.total}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${(row.total / maxAct) * 100}%` }} /></div></li>))}</ul>}<Link href="/bitacora" className="mt-4 inline-block text-sm font-medium text-teal-700">Ver bitácora →</Link></section>
        <section className={cardClassName}><h2 className="font-medium text-slate-900">Signos fuera de rango</h2>{report.outOfRangeVitals.length === 0 ? <p className="mt-4 text-sm text-slate-500">Sin alertas.</p> : <table className="mt-4 w-full text-sm"><thead><tr className="text-slate-500"><th className="pb-2 text-left">Fecha</th><th className="pb-2 text-left">Paciente</th><th className="pb-2 text-left">Alertas</th></tr></thead><tbody>{report.outOfRangeVitals.map((row) => (<tr key={row.id} className="border-t"><td className="py-2">{row.recordedAt.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td><td className="py-2"><Link href={`/pacientes/${row.patientId}?tab=signos`} className="text-teal-700">{row.chartNumber} — {row.patientName}</Link></td><td className="py-2">{row.alerts.map((a) => `${a.metric} ${a.value} (${a.note})`).join("; ")}</td></tr>))}</tbody></table>}</section>
      </div>
    </div>
  );
}
function PeriodLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</Link>;
}
function MetricCard({ label, value, href, highlight = false }: { label: string; value: number; href?: string; highlight?: boolean }) {
  const inner = (<><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-3xl font-semibold ${highlight ? "text-amber-700" : "text-slate-900"}`}>{value}</p></>);
  return href ? <Link href={href} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-200">{inner}</Link> : <div className="rounded-xl border border-slate-200 bg-white p-5">{inner}</div>;
}
