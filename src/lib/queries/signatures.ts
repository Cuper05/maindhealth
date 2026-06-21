import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digitalSignaturesTable } from "@/lib/db/schema";

export async function getPrescriptionSignature(prescriptionId: number) {
  const [row] = await db
    .select()
    .from(digitalSignaturesTable)
    .where(
      and(
        eq(digitalSignaturesTable.entityType, "prescription"),
        eq(digitalSignaturesTable.entityId, prescriptionId),
      ),
    );
  return row ?? null;
}

export async function getConsultationSignature(consultationId: number) {
  const [row] = await db
    .select()
    .from(digitalSignaturesTable)
    .where(
      and(
        eq(digitalSignaturesTable.entityType, "consultation"),
        eq(digitalSignaturesTable.entityId, consultationId),
      ),
    );
  return row ?? null;
}
