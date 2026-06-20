"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { logActivity } from "@/lib/audit/log-activity";
import { db } from "@/lib/db";
import {
  catalogDiagnosesTable,
  catalogMedicationsTable,
  catalogSymptomsTable,
} from "@/lib/db/schema";
import {
  parseDiagnosisForm,
  parseMedicationForm,
  parseSymptomForm,
} from "@/lib/validators/catalog-extended";

const CATALOGS_PATH = "/configuracion/catalogos";

export async function createSymptom(_prev: unknown, formData: FormData) {
  const session = await getActionSession("config:view");
  if ("error" in session) return actionError(session.error);

  const parsed = parseSymptomForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const [row] = await db
    .insert(catalogSymptomsTable)
    .values({
      name: data.name,
      category: data.category,
      description: data.description,
    })
    .returning({ id: catalogSymptomsTable.id });

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "crear",
    recordId: row.id,
    detail: `Síntoma: ${data.name}`,
  });

  revalidatePath(CATALOGS_PATH);
  return actionSuccess({});
}

export async function createDiagnosis(_prev: unknown, formData: FormData) {
  const session = await getActionSession("config:view");
  if ("error" in session) return actionError(session.error);

  const parsed = parseDiagnosisForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const [row] = await db
    .insert(catalogDiagnosesTable)
    .values({
      code: data.code,
      name: data.name,
      description: data.description,
    })
    .returning({ id: catalogDiagnosesTable.id });

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "crear",
    recordId: row.id,
    detail: `Diagnóstico: ${data.name}`,
  });

  revalidatePath(CATALOGS_PATH);
  return actionSuccess({});
}

export async function createMedication(_prev: unknown, formData: FormData) {
  const session = await getActionSession("config:view");
  if ("error" in session) return actionError(session.error);

  const parsed = parseMedicationForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const [row] = await db
    .insert(catalogMedicationsTable)
    .values({
      name: data.name,
      genericName: data.genericName,
      form: data.form,
      strength: data.strength,
      description: data.description,
    })
    .returning({ id: catalogMedicationsTable.id });

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: "crear",
    recordId: row.id,
    detail: `Medicamento: ${data.name}`,
  });

  revalidatePath(CATALOGS_PATH);
  return actionSuccess({});
}

export async function toggleSymptomActive(id: number, active: boolean): Promise<void> {
  const session = await getActionSession("config:view");
  if ("error" in session) return;

  await db
    .update(catalogSymptomsTable)
    .set({ active })
    .where(eq(catalogSymptomsTable.id, id));

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: active ? "activar" : "desactivar",
    recordId: id,
    detail: "Síntoma",
  });

  revalidatePath(CATALOGS_PATH);
}

export async function toggleDiagnosisActive(id: number, active: boolean): Promise<void> {
  const session = await getActionSession("config:view");
  if ("error" in session) return;

  await db
    .update(catalogDiagnosesTable)
    .set({ active })
    .where(eq(catalogDiagnosesTable.id, id));

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: active ? "activar" : "desactivar",
    recordId: id,
    detail: "Diagnóstico",
  });

  revalidatePath(CATALOGS_PATH);
}

export async function toggleMedicationActive(id: number, active: boolean): Promise<void> {
  const session = await getActionSession("config:view");
  if ("error" in session) return;

  await db
    .update(catalogMedicationsTable)
    .set({ active })
    .where(eq(catalogMedicationsTable.id, id));

  await logActivity({
    userId: session.userId,
    module: "configuracion",
    action: active ? "activar" : "desactivar",
    recordId: id,
    detail: "Medicamento",
  });

  revalidatePath(CATALOGS_PATH);
}
