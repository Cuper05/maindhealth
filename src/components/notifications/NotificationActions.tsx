"use client";

import Link from "next/link";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { SubmitButton } from "@/components/ui/PageHeader";
import { useActionState } from "react";

export function MarkAllReadButton() {
  const [, formAction, pending] = useActionState(markAllNotificationsRead, null);

  return (
    <form action={formAction}>
      <SubmitButton label="Marcar todas como leídas" pending={pending} />
    </form>
  );
}

export function MarkReadButton({ notificationId }: { notificationId: number }) {
  return (
    <form action={markNotificationRead.bind(null, notificationId)}>
      <button
        type="submit"
        className="text-xs font-medium text-teal-700 hover:underline"
      >
        Marcar leída
      </button>
    </form>
  );
}

export function NotificationLink({
  href,
  children,
}: {
  href?: string | null;
  children: React.ReactNode;
}) {
  if (!href) return <>{children}</>;
  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="hover:underline">
      {children}
    </Link>
  );
}
