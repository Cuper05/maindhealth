import { requirePatientId } from "@/lib/auth/patient-scope";
import { requireSession } from "@/lib/auth/session";
import { markMessagesRead } from "@/lib/actions/clinical-messages";
import {
  formatMessageSender,
  getPatientMessages,
} from "@/lib/queries/messages";
import { MessageComposer } from "@/components/portal/MessageComposer";
import { MessageThread } from "@/components/portal/MessageThread";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClassName } from "@/lib/ui/classes";

export default async function PortalMensajesPage() {
  const session = await requireSession();
  const patientId = await requirePatientId(session!);
  if (!patientId) return null;

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
        title="Mensajes"
        description="Comunicación segura con el equipo clínico."
      />
      <div className="space-y-6">
        <MessageThread messages={messages} />
        <section className={cardClassName}>
          <h2 className="mb-3 text-sm font-medium text-slate-900">Nuevo mensaje</h2>
          <MessageComposer patientId={patientId} />
        </section>
      </div>
    </div>
  );
}
