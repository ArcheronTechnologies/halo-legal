import { describe, expect, it } from "vitest";
import { daysSinceCapture, shouldSuggestRecalibration } from "./recalibration.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("daysSinceCapture", () => {
  it("computes exact whole days (hand-derived)", () => {
    expect(daysSinceCapture(0, 30 * MS_PER_DAY)).toBe(30);
  });

  it("computes fractional days", () => {
    expect(daysSinceCapture(0, 1.5 * MS_PER_DAY)).toBeCloseTo(1.5, 6);
  });
});

describe("shouldSuggestRecalibration", () => {
  it("is true at exactly the default 30-day threshold", () => {
    expect(shouldSuggestRecalibration({ capturedAt: 0 }, 30 * MS_PER_DAY)).toBe(true);
  });

  it("is false just under the default threshold", () => {
    expect(shouldSuggestRecalibration({ capturedAt: 0 }, 29 * MS_PER_DAY)).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(shouldSuggestRecalibration({ capturedAt: 0 }, 10 * MS_PER_DAY, 10)).toBe(true);
    expect(shouldSuggestRecalibration({ capturedAt: 0 }, 9 * MS_PER_DAY, 10)).toBe(false);
  });

  it("is false for a freshly captured baseline", () => {
    expect(shouldSuggestRecalibration({ capturedAt: 1000 }, 1000)).toBe(false);
  });
});
