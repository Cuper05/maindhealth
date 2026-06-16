import Link from "next/link";
import { buttonSecondaryClassName } from "@/lib/ui/classes";

export function PageHeader({
  title,
  description,
  backHref,
  action,
}: {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-block text-sm text-teal-700 hover:underline"
          >
            ← Volver
          </Link>
        )}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-slate-600">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function FormAlert({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm ${
        error
          ? "border border-red-200 bg-red-50 text-red-700"
          : "border border-teal-200 bg-teal-50 text-teal-800"
      }`}
    >
      {error ?? success}
    </div>
  );
}

export function SubmitButton({
  label,
  pendingLabel = "Guardando…",
  pending,
}: {
  label: string;
  pendingLabel?: string;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CancelLink({ href }: { href: string }) {
  return (
    <Link href={href} className={buttonSecondaryClassName}>
      Cancelar
    </Link>
  );
}
