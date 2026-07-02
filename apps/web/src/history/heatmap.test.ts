import { describe, expect, it } from "vitest";
import { computeTimeOfDayHeatmap } from "./heatmap.js";

// Ground truth (verified via `new Date(...).getUTCDay()/getUTCHours()` in this UTC sandbox):
// 2026-01-05T09:30Z / 09:45Z -> Monday(1) hour 9; 2026-01-05T14:00Z -> Monday hour 14;
// 2026-01-06T09:30Z -> Tuesday(2) hour 9.
const mon9a = Date.UTC(2026, 0, 5, 9, 30, 0);
const mon9b = Date.UTC(2026, 0, 5, 9, 45, 0);
const mon14 = Date.UTC(2026, 0, 5, 14, 0, 0);
const tue9 = Date.UTC(2026, 0, 6, 9, 30, 0);

describe("computeTimeOfDayHeatmap", () => {
  it("groups samples by (dayOfWeek, hour) and averages stressIndex within each cell", () => {
    const cells = computeTimeOfDayHeatmap([
      { t: mon9a, stressIndex: 40 },
      { t: mon9b, stressIndex: 60 },
      { t: mon14, stressIndex: 80 },
      { t: tue9, stressIndex: 20 },
    ]);

    expect(cells).toHaveLength(3);
    expect(cells).toContainEqual({ dayOfWeek: 1, hour: 9, meanStressIndex: 50, sampleCount: 2 });
    expect(cells).toContainEqual({ dayOfWeek: 1, hour: 14, meanStressIndex: 80, sampleCount: 1 });
    expect(cells).toContainEqual({ dayOfWeek: 2, hour: 9, meanStressIndex: 20, sampleCount: 1 });
  });

  it("returns an empty array for no samples", () => {
    expect(computeTimeOfDayHeatmap([])).toEqual([]);
  });

  it("does not fabricate cells for (day, hour) combinations with no data", () => {
    const cells = computeTimeOfDayHeatmap([{ t: mon9a, stressIndex: 50 }]);
    expect(cells).toHaveLength(1);
  });
});
