import { describe, expect, it } from "vitest";
import { displayTreatmentPlan, normalizeAssessmentText } from "./assessment-text";

describe("normalizeAssessmentText", () => {
  it("keeps normal strings", () => {
    expect(normalizeAssessmentText("Reposo e hidratación", "fallback")).toBe("Reposo e hidratación");
  });

  it("rejects [object Object] corruption", () => {
    expect(normalizeAssessmentText("[object Object],[object Object]", "fallback")).toBe("fallback");
  });

  it("stringifies medication-shaped arrays", () => {
    expect(
      normalizeAssessmentText(
        [
          { medication: "Paracetamol", dose: "500 mg", frequency: "Cada 8 horas" },
          { medication: "Loratadina", dose: "10 mg" },
        ],
        "fallback",
      ),
    ).toBe("Paracetamol · 500 mg · Cada 8 horas. Loratadina · 10 mg");
  });

  it("uses nested text fields from objects", () => {
    expect(normalizeAssessmentText({ text: "Medidas generales" }, "fallback")).toBe(
      "Medidas generales",
    );
  });
});

describe("displayTreatmentPlan", () => {
  it("falls back to medications when plan is corrupted", () => {
    expect(
      displayTreatmentPlan("[object Object],[object Object]", [
        { medication: "Paracetamol", dose: "500 mg", frequency: "Cada 8 horas" },
      ]),
    ).toBe("Paracetamol · 500 mg · Cada 8 horas");
  });
});
