import Link from "next/link";
import { count, eq, gte, lt, and, sql } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  followUpsTable,
  patientsTable,
  rolesTable,
  usersTable,
} from "@/lib/db/schema";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";

export default async function HomePage() {
  const session = await requireSession();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [[patientRow], [doctorRow], [apptRow], [followUpRow]] =
    await Promise.all([
      db.select({ total: count() }).from(patientsTable),
      db
        .select({ total: count() })
        .from(usersTable)
        .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
        .where(and(eq(rolesTable.code, "doctor"), eq(usersTable.active, true))),
      db
        .select({ total: count() })
        .from(appointmentsTable)
        .where(
          and(
            gte(appointmentsTable.startAt, today),
            lt(appointmentsTable.startAt, tomorrow),
          ),
        ),
      db
        .select({ total: count() })
        .from(followUpsTable)
        .where(
          and(
            sql`${followUpsTable.nextReviewAt} IS NOT NULL`,
            gte(followUpsTable.nextReviewAt, today),
          ),
        ),
    ]);

  const unreadNotifications =
    session?.userId && can(session.role, "notifications:view")
      ? await getUnreadNotificationCount(session.userId)
      : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Bienvenido, {session?.name}
      </h1>
      <p className="mt-1 text-slate-600">
        Panel del teleconsultorio MaindHealth — MVP Fase 1.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pacientes" value={patientRow?.total ?? 0} href="/pacientes" />
        <StatCard label="Médicos activos" value={doctorRow?.total ?? 0} href="/configuracion" />
        <StatCard label="Citas hoy" value={apptRow?.total ?? 0} href="/agenda" />
        <StatCard
          label="Seguimientos pendientes"
          value={followUpRow?.total ?? 0}
          href="/seguimientos"
        />
        {can(session?.role, "notifications:view") && (
          <StatCard
            label="Notificaciones sin leer"
            value={unreadNotifications}
            href="/notificaciones"
          />
        )}
      </div>

      <section className="mt-10 rounded-xl border border-teal-100 bg-teal-50/50 p-6">
        <h2 className="font-medium text-teal-900">Flujo clínico MVP</h2>
        <p className="mt-2 text-sm text-teal-800/90">
          Pacientes → Agenda → Triage → Consulta → Receta → Seguimiento
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["/pacientes", "Pacientes"],
            ["/agenda", "Agenda"],
            ["/triage", "Triage"],
            ["/consultas", "Consultas"],
            ["/recetas", "Recetas"],
            ["/seguimientos", "Seguimientos"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg bg-white px-3 py-1.5 text-sm text-teal-800 shadow-sm ring-1 ring-teal-100 hover:bg-teal-50"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-200 hover:shadow-sm"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
