import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { patientsTable } from "@/lib/db/schema";

export function normalizePhoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Busca un expediente existente para evitar altas duplicadas.
 * Prioridad: teléfono (dígitos) → CURP → correo → nombre+fecha nacimiento.
 * Prefiere pacientes activos sobre archivados.
 */
export async function findExistingPatientRecord(input: {
  phone?: string | null;
  email?: string | null;
  curp?: string | null;
  firstName?: string | null;
  lastNamePaternal?: string | null;
  birthDate?: string | null;
  /** Excluir este id (útil al editar). */
  excludeId?: number;
}) {
  const conditions = [];
  const phoneDigits = normalizePhoneDigits(input.phone);
  if (phoneDigits.length >= 10) {
    conditions.push(
      sql`regexp_replace(coalesce(${patientsTable.phone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`,
    );
  }
  if (input.curp?.trim()) {
    conditions.push(eq(patientsTable.curp, input.curp.trim().toUpperCase()));
  }
  if (input.email?.trim()) {
    conditions.push(eq(patientsTable.email, input.email.trim().toLowerCase()));
  }
  if (input.firstName?.trim() && input.lastNamePaternal?.trim() && input.birthDate?.trim()) {
    conditions.push(
      and(
        sql`lower(trim(${patientsTable.firstName})) = ${input.firstName.trim().toLowerCase()}`,
        sql`lower(trim(${patientsTable.lastNamePaternal})) = ${input.lastNamePaternal.trim().toLowerCase()}`,
        eq(patientsTable.birthDate, input.birthDate.trim()),
      )!,
    );
  }

  if (conditions.length === 0) return null;

  const whereParts = [
    or(...conditions)!,
    ne(patientsTable.status, "deleted"),
  ];
  if (input.excludeId) {
    whereParts.push(ne(patientsTable.id, input.excludeId));
  }

  const rows = await db
    .select()
    .from(patientsTable)
    .where(and(...whereParts))
    .orderBy(
      sql`case when ${patientsTable.status} = 'active' then 0 when ${patientsTable.status} = 'archived' then 1 else 2 end`,
      desc(patientsTable.id),
    )
    .limit(1);

  return rows[0] ?? null;
}
