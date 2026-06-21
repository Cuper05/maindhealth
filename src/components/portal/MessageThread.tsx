import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/constants";
import { cardClassName } from "@/lib/ui/classes";

type Message = {
  id: number;
  body: string;
  senderRole: string;
  createdAt: Date;
  senderName: string;
};

export function MessageThread({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-slate-500">Aún no hay mensajes. Inicia la conversación abajo.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((msg) => {
        const isPatient = msg.senderRole === "patient";
        return (
          <li
            key={msg.id}
            className={`${cardClassName} ${isPatient ? "border-teal-100 bg-teal-50/40" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                {msg.senderName}
                {!isPatient && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ({ROLE_LABELS[msg.senderRole as UserRole] ?? msg.senderRole})
                  </span>
                )}
              </p>
              <time className="text-xs text-slate-500">
                {msg.createdAt.toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{msg.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
