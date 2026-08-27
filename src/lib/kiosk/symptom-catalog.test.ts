import { describe, expect, it } from "vitest";
import {
  buildChiefComplaintFromSelection,
  detectSymptomRedFlags,
  emptySymptomSelection,
  getIncompleteSymptomDetailKeys,
  getSymptomSelectionGaps,
  hasImmediateEscalationSymptoms,
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
    expect(getSymptomSelectionGaps(selection)[0]).toMatch(/dónde lo siente/i);
  });

  it("requires body location when ardor is selected", () => {
    const selection = {
      ...emptySymptomSelection(),
      primary: ["ardor" as const],
      painLocations: [],
    };
    expect(isSymptomSelectionComplete(selection)).toBe(false);
    expect(getSymptomSelectionGaps(selection)[0]).toMatch(/ardor/i);
    expect(getSymptomSelectionGaps(selection)[0]).toMatch(/dónde lo siente/i);
  });

  it("builds ardor complaint with location", () => {
    const selection = {
      ...emptySymptomSelection(),
      primary: ["ardor" as const],
      painLocations: ["pecho" as const],
      painDetails: {
        pecho: { intensity: "moderada" as const, duration: "horas" as const },
      },
    };
    expect(buildChiefComplaintFromSelection(selection)).toContain("ardor en pecho");
    expect(isSymptomSelectionComplete(selection)).toBe(true);
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
    expect(gaps.some((g) => /Ardor o molestia al orinar/.test(g))).toBe(true);
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
    expect(buildChiefComplaintFromSelection(complete)).toContain("ardor al orinar");
  });

  it("explains empty selection clearly", () => {
    expect(getSymptomSelectionGaps(emptySymptomSelection())[0]).toMatch(/al menos un síntoma/i);
  });

  it("flags neuro/allergy symptoms for immediate escalation", () => {
    const selection = {
      ...emptySymptomSelection(),
      primary: ["desmayo" as const, "dificultad_hablar" as const],
      symptomDetails: {
        desmayo: { intensity: "intensa" as const, duration: "horas" as const },
        dificultad_hablar: { intensity: "moderada" as const, duration: "horas" as const },
      },
    };
    const flags = detectSymptomRedFlags(selection);
    expect(flags.some((f) => /desmayo/i.test(f))).toBe(true);
    expect(flags.some((f) => /hablar|neurológ/i.test(f))).toBe(true);
    expect(hasImmediateEscalationSymptoms(selection)).toBe(true);
    expect(buildChiefComplaintFromSelection(selection)).toContain("desmayo");
    expect(buildChiefComplaintFromSelection(selection)).toContain("dificultad para hablar");
  });

  it("flags intense abdominal pain", () => {
    const selection = {
      ...emptySymptomSelection(),
      primary: ["dolor" as const],
      painLocations: ["abdomen_bajo" as const],
      painDetails: {
        abdomen_bajo: { intensity: "intensa" as const, duration: "horas" as const },
      },
    };
    expect(detectSymptomRedFlags(selection).some((f) => /abdominal intenso/i.test(f))).toBe(true);
  });
});
