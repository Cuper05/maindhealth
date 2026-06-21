"use client";

import { useActionState } from "react";
import { sendClinicalMessage } from "@/lib/actions/clinical-messages";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import { textareaClassName } from "@/lib/ui/classes";

export function MessageComposer({ patientId }: { patientId: number }) {
  const [state, formAction, pending] = useActionState(sendClinicalMessage, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Mensaje enviado." : undefined}
      />
      <textarea
        name="body"
        rows={3}
        required
        minLength={1}
        placeholder="Escribe tu mensaje…"
        className={textareaClassName}
      />
      <SubmitButton label="Enviar" pendingLabel="Enviando…" pending={pending} />
    </form>
  );
}
