function formatPlanObject(record: Record<string, unknown>): string {
  const textField = [
    record.text,
    record.description,
    record.step,
    record.title,
    record.name,
    record.summary,
    record.plan,
  ].find((v) => typeof v === "string" && v.trim());
  if (typeof textField === "string") return textField.trim();

  // Medication-shaped objects from protocol / mistaken OpenAI payloads
  if (typeof record.medication === "string" && record.medication.trim()) {
    return [record.medication, record.dose, record.frequency, record.duration, record.route]
      .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
      .join(" · ");
  }
  return "";
}

/** OpenAI a veces devuelve arrays/objetos; la UI no debe mostrar [object Object]. */
export function normalizeAssessmentText(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Already-corrupted String(object) from a previous buggy path
    if (!trimmed || /\[object Object\]/i.test(trimmed)) return fallback;
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") return formatPlanObject(item as Record<string, unknown>);
        return "";
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(". ");
  }
  if (value && typeof value === "object") {
    const nested = formatPlanObject(value as Record<string, unknown>);
    if (nested) return nested;
  }
  return fallback;
}

/** UI-safe treatment plan; falls back to medication list when plan text is unusable. */
export function displayTreatmentPlan(
  treatmentPlan: unknown,
  medications: Array<{ medication?: string; dose?: string | null; frequency?: string | null }> = [],
  fallback = "Seguir indicaciones del protocolo autorizado.",
): string {
  const text = normalizeAssessmentText(treatmentPlan, "");
  if (text) return text;
  if (medications.length > 0) {
    return medications
      .map((m) =>
        [m.medication, m.dose, m.frequency]
          .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
          .join(" · "),
      )
      .filter(Boolean)
      .join(". ");
  }
  return fallback;
}
