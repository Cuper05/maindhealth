import { describe, expect, it } from "vitest";
import { analyzeEcgWave } from "./ecg-wave-screen";
import { buildSyntheticEcgWave, stripProtocolConstant } from "./station-ecg";

describe("stripProtocolConstant", () => {
  it("quita el 34 intercalado del MD100C_P", () => {
    const raw = [34, 146, 34, 147, 34, 152, 34, 138, 34, 135];
    expect(stripProtocolConstant(raw)).toEqual([146, 147, 152, 138, 135]);
  });
});

/** Onda ~60 Hz (tasa post-filtro MD100C) con latidos a `bpm`. */
function syntheticAtBpm(bpm: number, seconds = 20, sampleRate = 60): number[] {
  const n = seconds * sampleRate;
  const samplesPerBeat = Math.max(8, Math.round((60 / bpm) * sampleRate));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const phase = i % samplesPerBeat;
    let y = 500;
    const r0 = Math.floor(samplesPerBeat * 0.22);
    const r1 = Math.floor(samplesPerBeat * 0.3);
    const rPeak = Math.floor((r0 + r1) / 2);
    if (phase >= r0 && phase <= r1) {
      y += phase === rPeak ? 220 : 80;
    } else if (phase > r1 && phase < r1 + 4) {
      y -= 40;
    } else if (phase > samplesPerBeat * 0.5 && phase < samplesPerBeat * 0.72) {
      const u = (phase - samplesPerBeat * 0.5) / (samplesPerBeat * 0.22);
      y += 35 * Math.sin(u * Math.PI);
    }
    y += Math.sin(i / 25) * 3;
    out.push(y);
  }
  return out;
}

/** RR irregulares (jitter grande) → irregular / possible_af. */
function irregularWave(seconds = 25, sampleRate = 60): number[] {
  const out: number[] = [];
  let t = 0;
  const total = seconds * sampleRate;
  const gaps = [0.45, 0.9, 0.55, 1.1, 0.5, 0.95, 0.48, 1.05, 0.52, 0.88, 0.6, 1.0];
  let gapIdx = 0;
  let nextPeak = Math.round(gaps[0]! * sampleRate);
  while (t < total) {
    let y = 500 + Math.sin(t / 20) * 4;
    if (t === nextPeak || (t > nextPeak && t < nextPeak + 2)) {
      y += t === nextPeak + 1 ? 240 : 90;
    }
    if (t === nextPeak + 2) {
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

  it("acepta buffers cortos post-filtro (~120–200 pts) si hay morfología", () => {
    const wave = syntheticAtBpm(72, 3, 60); // 180 pts
    expect(wave.length).toBeGreaterThan(90);
    expect(wave.length).toBeLessThan(360);
    const r = analyzeEcgWave(wave);
    expect(r.flags).not.toContain("poor_signal");
    expect(["good", "fair"]).toContain(r.quality);
  });

  it("señal plana → poor sin sospechas clínicas", () => {
    const flat = Array.from({ length: 60 * 15 }, () => 100);
    const r = analyzeEcgWave(flat);
    expect(r.quality).toBe("poor");
    expect(r.flags).toEqual(["poor_signal"]);
  });

  it("onda sintética regular ~72: sin flags fuertes", () => {
    const wave = buildSyntheticEcgWave(60 * 18);
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

  it("bradicardia estimada < 60 (protocolo adulto)", () => {
    const r = analyzeEcgWave(syntheticAtBpm(42, 30));
    expect(r.quality).not.toBe("poor");
    expect(r.flags).toContain("bradycardia");
    expect(r.estimatedHr).not.toBeNull();
    if (r.estimatedHr != null) {
      expect(r.estimatedHr).toBeLessThan(60);
    }
  });

  it("taquicardia estimada > 100 (protocolo adulto)", () => {
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
