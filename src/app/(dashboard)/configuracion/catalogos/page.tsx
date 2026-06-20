import Link from "next/link";
import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  CatalogDiagnosesPanel,
  CatalogMedicationsPanel,
  CatalogSymptomsPanel,
} from "@/components/forms/CatalogForms";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  catalogDiagnosesTable,
  catalogMedicationsTable,
  catalogSymptomsTable,
} from "@/lib/db/schema";

const TABS = [
  { key: "sintomas", label: "Síntomas" },
  { key: "diagnosticos", label: "Diagnósticos" },
  { key: "medicamentos", label: "Medicamentos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export default async function CatalogosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "config:view")) redirect("/");

  const { tab: tabParam } = await searchParams;
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "sintomas";

  const [symptoms, diagnoses, medications] = await Promise.all([
    db.select().from(catalogSymptomsTable).orderBy(asc(catalogSymptomsTable.name)),
    db.select().from(catalogDiagnosesTable).orderBy(asc(catalogDiagnosesTable.name)),
    db.select().from(catalogMedicationsTable).orderBy(asc(catalogMedicationsTable.name)),
  ]);

  return (
    <div>
      <PageHeader
        title="Catálogos clínicos"
        description="Síntomas, diagnósticos y medicamentos para consultas y recetas."
        backHref="/configuracion"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/configuracion/catalogos?tab=${key}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === key
                ? "bg-teal-50 font-medium text-teal-800"
                : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "sintomas" && <CatalogSymptomsPanel rows={symptoms} />}
      {tab === "diagnosticos" && <CatalogDiagnosesPanel rows={diagnoses} />}
      {tab === "medicamentos" && <CatalogMedicationsPanel rows={medications} />}
    </div>
  );
}
