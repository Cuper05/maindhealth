import { describe, expect, it } from "vitest";
import { analyzeEcgWave } from "./ecg-wave-screen";
import { buildSyntheticEcgWave, stripProtocolConstant } from "./station-ecg";

describe("stripProtocolConstant", () => {
  it("quita el 34 intercalado del MD100C_P", () => {
    const raw = [34, 146, 34, 147, 34, 152, 34, 138, 34, 135];
    expect(stripProtocolConstant(raw)).toEqual([146, 147, 152, 138, 135]);
  });
});

/** Onda ~120 Hz con latidos a `bpm` durante `seconds`. */
function syntheticAtBpm(bpm: number, seconds = 20, sampleRate = 120): number[] {
  const n = seconds * sampleRate;
  const samplesPerBeat = Math.round((60 / bpm) * sampleRate);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const phase = i % samplesPerBeat;
    let y = 500;
    // Pico R estrecho
    if (phase >= 12 && phase <= 16) {
      y += phase === 14 ? 220 : 80;
    } else if (phase > 16 && phase < 22) {
      y -= 40;
    } else if (phase > 30 && phase < 45) {
      y += 35 * Math.sin(((phase - 30) / 15) * Math.PI);
    }
    y += Math.sin(i / 40) * 3;
    out.push(y);
  }
  return out;
}

/** RR irregulares (jitter grande) → irregular / possible_af. */
function irregularWave(seconds = 25, sampleRate = 120): number[] {
  const out: number[] = [];
  let t = 0;
  const total = seconds * sampleRate;
  const gaps = [0.45, 0.9, 0.55, 1.1, 0.5, 0.95, 0.48, 1.05, 0.52, 0.88, 0.6, 1.0];
  let gapIdx = 0;
  let nextPeak = Math.round(gaps[0]! * sampleRate);
  while (t < total) {
    let y = 500 + Math.sin(t / 35) * 4;
    if (t === nextPeak || (t > nextPeak && t < nextPeak + 3)) {
      y += t === nextPeak + 1 ? 240 : 90;
    }
    if (t === nextPeak + 3) {
      gapIdx = (gapIdx + 1) % gaps.length;
      nextPeak += Math.round(gaps[gapIdx]! * sampleRate);
    }
    out.push(y);
    t++;
  }
  return out;
}

describe("analyzeEcgWave", () => {
  it("marca poor_signal con pocos puntos", () => {
    const r = analyzeEcgWave([1, 2, 3, 4, 5]);
    expect(r.quality).toBe("poor");
    expect(r.flags).toContain("poor_signal");
    expect(r.flags).not.toContain("possible_af");
  });

  it("señal plana → poor sin sospechas clínicas", () => {
    const flat = Array.from({ length: 120 * 15 }, () => 100);
    const r = analyzeEcgWave(flat);
    expect(r.quality).toBe("poor");
    expect(r.flags).toEqual(["poor_signal"]);
  });

  it("onda sintética regular ~72: sin flags fuertes", () => {
    const wave = buildSyntheticEcgWave(120 * 18);
    // buildSyntheticEcgWave ya es denso tipo PQRST ~72
    const r = analyzeEcgWave(syntheticAtBpm(72, 22));
    expect(["good", "fair"]).toContain(r.quality);
    expect(r.flags).not.toContain("poor_signal");
    expect(r.flags).not.toContain("possible_af");
    expect(r.estimatedHr).not.toBeNull();
    if (r.estimatedHr != null) {
      expect(r.estimatedHr).toBeGreaterThan(55);
      expect(r.estimatedHr).toBeLessThan(95);
    }
    expect(r.disclaimerEs.toLowerCase()).toContain("no es diagnóstico");
    void wave;
  });

  it("bradicardia estimada < 50", () => {
    const r = analyzeEcgWave(syntheticAtBpm(42, 30));
    expect(r.quality).not.toBe("poor");
    expect(r.flags).toContain("bradycardia");
    expect(r.estimatedHr).not.toBeNull();
    if (r.estimatedHr != null) {
      expect(r.estimatedHr).toBeLessThan(50);
    }
  });

  it("taquicardia estimada > 120", () => {
    const r = analyzeEcgWave(syntheticAtBpm(140, 20));
    expect(r.quality).not.toBe("poor");
    expect(r.flags).toContain("tachycardia");
  });

  it("RR irregulares → irregular y possible_af", () => {
    const r = analyzeEcgWave(irregularWave(28));
    expect(r.quality).not.toBe("poor");
    expect(r.flags).toContain("irregular");
    expect(r.flags).toContain("possible_af");
  });

  it("hr_mismatch si oxímetro difiere > 15", () => {
    const r = analyzeEcgWave(syntheticAtBpm(72, 20), { oximeterHr: 110 });
    expect(r.flags).toContain("hr_mismatch");
  });
});
