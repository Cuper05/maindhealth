import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { markMessagesRead } from "@/lib/actions/clinical-messages";
import {
  formatMessageSender,
  getPatientMessages,
} from "@/lib/queries/messages";
import { getPatientSummary } from "@/lib/queries/portal";
import { MessageComposer } from "@/components/portal/MessageComposer";
import { MessageThread } from "@/components/portal/MessageThread";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";
import { formatPersonName } from "@/lib/format/name";

export default async function MensajesPacientePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await requireSession();
  if (!can(session?.role, "messages:view")) redirect("/");

  const { patientId: patientIdParam } = await params;
  const patientId = Number(patientIdParam);
  if (!Number.isFinite(patientId)) notFound();

  const patient = await getPatientSummary(patientId);
  if (!patient) notFound();

  await markMessagesRead(patientId);
  const rows = await getPatientMessages(patientId);
  const messages = rows.map((row) => ({
    id: row.id,
    body: row.body,
    senderRole: row.senderRole,
    createdAt: row.createdAt,
    senderName: formatMessageSender(row),
  }));

  return (
    <div>
      <PageHeader
        title={`Mensajes — ${formatPersonName(patient)}`}
        description={`Expediente ${patient.chartNumber}`}
        backHref="/mensajes"
        action={
          <Link
            href={`/pacientes/${patientId}`}
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            Ver expediente
          </Link>
        }
      />
      <div className="space-y-6">
        <MessageThread messages={messages} />
        <section className={cardClassName}>
          <h2 className="mb-3 text-sm font-medium text-slate-900">Responder</h2>
          <MessageComposer patientId={patientId} />
        </section>
      </div>
    </div>
  );
}
