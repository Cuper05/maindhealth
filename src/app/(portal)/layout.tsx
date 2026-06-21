import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { requireSession } from "@/lib/auth/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session?.userId || !session.role || !session.name) {
    redirect("/login");
  }
  if (session.role !== "patient") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/40 to-slate-50">
      <PortalNav userName={session.name} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
