import { describe, expect, it } from "vitest";
import {
  buildChiefComplaintFromSelection,
  emptySymptomSelection,
  getIncompleteSymptomDetailKeys,
  getSymptomSelectionGaps,
  isSymptomSelectionComplete,
} from "./symptom-catalog";

describe("symptom catalog", () => {
  it("builds GI complaint from pain + abdomen with per-symptom detail", () => {
    const selection = {
      ...emptySymptomSelection(),
      primary: ["dolor" as const],
      painLocations: ["abdomen" as const],
      painDetails: {
        abdomen: { intensity: "moderada" as const, duration: "1_2_dias" as const },
      },
    };
    expect(buildChiefComplaintFromSelection(selection)).toContain("dolor estomacal");
    expect(buildChiefComplaintFromSelection(selection)).toContain("intensidad moderada");
    expect(isSymptomSelectionComplete(selection)).toBe(true);
    expect(getSymptomSelectionGaps(selection)).toEqual([]);
  });

  it("requires pain location when dolor is selected", () => {
    const selection = {
      ...emptySymptomSelection(),
      primary: ["dolor" as const],
      painLocations: [],
    };
    expect(isSymptomSelectionComplete(selection)).toBe(false);
    expect(getSymptomSelectionGaps(selection)[0]).toMatch(/dónde duele/i);
  });

  it("requires intensity and duration per symptom", () => {
    const incomplete = {
      ...emptySymptomSelection(),
      primary: ["palpitaciones" as const, "sintomas_urinarios" as const],
      symptomDetails: {
        palpitaciones: { intensity: "moderada" as const },
      },
    };
    expect(isSymptomSelectionComplete(incomplete)).toBe(false);
    const gaps = getSymptomSelectionGaps(incomplete);
    expect(gaps.some((g) => /Palpitaciones/.test(g) && /Desde cuándo/.test(g))).toBe(true);
    expect(gaps.some((g) => /Molestia urinaria/.test(g))).toBe(true);
    expect(getIncompleteSymptomDetailKeys(incomplete).has("symptom-palpitaciones")).toBe(true);
    expect(getIncompleteSymptomDetailKeys(incomplete).has("symptom-sintomas_urinarios")).toBe(true);

    const complete = {
      ...incomplete,
      symptomDetails: {
        palpitaciones: { intensity: "moderada" as const, duration: "horas" as const },
        sintomas_urinarios: { intensity: "leve" as const, duration: "1_2_dias" as const },
      },
    };
    expect(isSymptomSelectionComplete(complete)).toBe(true);
    expect(getSymptomSelectionGaps(complete)).toEqual([]);
    expect(buildChiefComplaintFromSelection(complete)).toContain("palpitaciones");
    expect(buildChiefComplaintFromSelection(complete)).toContain("síntomas urinarios");
  });

  it("explains empty selection clearly", () => {
    expect(getSymptomSelectionGaps(emptySymptomSelection())[0]).toMatch(/al menos un síntoma/i);
  });
});
