import type { BehaviouralSample } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { computeBehaviouralWindow } from "./behaviouralWindow.js";

function sample(
  t: number,
  blinking: boolean,
  browTension = 0,
  lidTension = 0,
  lipTension = 0,
): BehaviouralSample {
  return { t, browTension, lidTension, lipTension, blinking };
}

describe("computeBehaviouralWindow", () => {
  it("averages tension features and counts blink events as rising edges, not blinking frames", () => {
    // 10 one-second samples (t=0..9, window duration 9s). Alternating brow tension, constant
    // lid/lip. Blink is TRUE for two consecutive frames (t=2,3) — that must count as ONE event,
    // plus a single-frame blink at t=7 — two events total, blinkRateHz = 2/9.
    const samples: BehaviouralSample[] = [
      sample(0, false, 0.1, 0.3, 0.05),
      sample(1, false, 0.2, 0.3, 0.05),
      sample(2, true, 0.1, 0.3, 0.05),
      sample(3, true, 0.2, 0.3, 0.05),
      sample(4, false, 0.1, 0.3, 0.05),
      sample(5, false, 0.2, 0.3, 0.05),
      sample(6, false, 0.1, 0.3, 0.05),
      sample(7, true, 0.2, 0.3, 0.05),
      sample(8, false, 0.1, 0.3, 0.05),
      sample(9, false, 0.2, 0.3, 0.05),
    ];

    const result = computeBehaviouralWindow(samples);

    expect(result.browTension).toBeCloseTo(0.15, 6); // mean of alternating 0.1/0.2
    expect(result.lidTension).toBeCloseTo(0.3, 6);
    expect(result.lipTension).toBeCloseTo(0.05, 6);
    expect(result.blinkRateHz).toBeCloseTo(2 / 9, 6); // 2 events, not 3 blinking frames
    expect(result.sampleCount).toBe(10);
    expect(result.windowStart).toBe(0);
    expect(result.windowEnd).toBe(9);
  });

  it("returns null blink-interval variability with fewer than 3 blink events", () => {
    const samples: BehaviouralSample[] = [
      sample(0, false),
      sample(1, true),
      sample(2, false),
      sample(3, true),
      sample(4, false),
    ];
    const result = computeBehaviouralWindow(samples);
    expect(result.blinkIntervalVariabilityMs).toBeNull();
  });

  it("computes blink-interval variability matching a hand-derived reference value", () => {
    // Isolated blink events at t=1,3,6,10 -> intervals [2s,3s,4s] -> mean 3000ms,
    // sample stddev (n-1=2 denominator): sqrt(((1000)^2+0+(1000)^2)/2) = 1000ms.
    const samples: BehaviouralSample[] = [
      sample(0, false),
      sample(1, true),
      sample(2, false),
      sample(3, true),
      sample(4, false),
      sample(5, false),
      sample(6, true),
      sample(7, false),
      sample(8, false),
      sample(9, false),
      sample(10, true),
      sample(11, false),
    ];
    const result = computeBehaviouralWindow(samples);
    expect(result.blinkIntervalVariabilityMs).toBeCloseTo(1000, 6);
    expect(result.blinkRateHz).toBeCloseTo(4 / 11, 6);
  });

  it("treats an already-blinking first frame as a blink event", () => {
    const samples: BehaviouralSample[] = [sample(0, true), sample(1, true), sample(2, false)];
    const result = computeBehaviouralWindow(samples);
    expect(result.blinkRateHz).toBeCloseTo(1 / 2, 6);
  });

  it("throws on an empty sample list", () => {
    expect(() => computeBehaviouralWindow([])).toThrow();
  });

  it("does not set headStillnessDeviation (not computed in Phase 1)", () => {
    const result = computeBehaviouralWindow([sample(0, false), sample(1, false)]);
    expect(result.headStillnessDeviation).toBeUndefined();
  });
});
