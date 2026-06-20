import type { CatalogOption } from "@/components/forms/CatalogAutocomplete";

type DiagnosisRow = {
  code: string | null;
  name: string;
};

type SymptomRow = {
  name: string;
  category: string | null;
};

export type MedicationCatalogOption = {
  name: string;
  strength: string | null;
  form: string | null;
  datalistValue: string;
};

type MedicationRow = {
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
};

export function formatDiagnosisOptions(rows: DiagnosisRow[]): CatalogOption[] {
  return rows.map((row) => {
    const value = row.code ? `${row.code} — ${row.name}` : row.name;
    return { value, label: value };
  });
}

export function formatSymptomOptions(rows: SymptomRow[]): CatalogOption[] {
  return rows.map((row) => ({
    value: row.name,
    label: row.category ? `${row.name} (${row.category})` : row.name,
  }));
}

export function formatMedicationOptions(rows: MedicationRow[]): MedicationCatalogOption[] {
  return rows.map((row) => ({
    name: row.name,
    strength: row.strength,
    form: row.form,
    datalistValue: row.genericName ? `${row.name} (${row.genericName})` : row.name,
  }));
}

export function findMedicationMatch(
  options: MedicationCatalogOption[],
  input: string,
): MedicationCatalogOption | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return options.find(
    (option) => option.name === trimmed || option.datalistValue === trimmed,
  );
}
