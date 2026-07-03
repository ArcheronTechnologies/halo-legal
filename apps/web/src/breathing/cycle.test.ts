import { describe, expect, it } from "vitest";
import { computeBreathingTick, DEFAULT_BREATHING_CYCLE } from "./cycle.js";

// DEFAULT_BREATHING_CYCLE = inhale 4s, exhale 6s, cycle length 10s. All values hand-derived.
describe("computeBreathingTick", () => {
  it("starts at the beginning of the inhale phase", () => {
    const tick = computeBreathingTick(0, DEFAULT_BREATHING_CYCLE);
    expect(tick).toEqual({ phase: "inhale", progress: 0, secondsRemaining: 4, cycleCount: 0 });
  });

  it("is halfway through inhale at t=2s", () => {
    const tick = computeBreathingTick(2, DEFAULT_BREATHING_CYCLE);
    expect(tick.phase).toBe("inhale");
    expect(tick.progress).toBeCloseTo(0.5, 6);
    expect(tick.secondsRemaining).toBe(2);
  });

  it("transitions to the start of exhale exactly at t=4s", () => {
    const tick = computeBreathingTick(4, DEFAULT_BREATHING_CYCLE);
    expect(tick).toEqual({ phase: "exhale", progress: 0, secondsRemaining: 6, cycleCount: 0 });
  });

  it("is halfway through exhale at t=7s", () => {
    const tick = computeBreathingTick(7, DEFAULT_BREATHING_CYCLE);
    expect(tick.phase).toBe("exhale");
    expect(tick.progress).toBeCloseTo(0.5, 6);
    expect(tick.secondsRemaining).toBe(3);
  });

  it("wraps to a new cycle at t=10s (one full 4+6s cycle)", () => {
    const tick = computeBreathingTick(10, DEFAULT_BREATHING_CYCLE);
    expect(tick).toEqual({ phase: "inhale", progress: 0, secondsRemaining: 4, cycleCount: 1 });
  });

  it("counts cycles correctly deep into a session (hand-derived: t=25s -> cycle 2, mid-exhale)", () => {
    const tick = computeBreathingTick(25, DEFAULT_BREATHING_CYCLE);
    expect(tick.cycleCount).toBe(2);
    expect(tick.phase).toBe("exhale");
    expect(tick.progress).toBeCloseTo(1 / 6, 6);
    expect(tick.secondsRemaining).toBe(5);
  });

  it("respects a custom cycle configuration", () => {
    const config = { inhaleSec: 5, exhaleSec: 5 };
    const tick = computeBreathingTick(5, config);
    expect(tick).toEqual({ phase: "exhale", progress: 0, secondsRemaining: 5, cycleCount: 0 });
  });
});
