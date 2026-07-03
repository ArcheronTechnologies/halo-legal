import { describe, expect, it } from "vitest";
import { computeRollups, dayKeyFor, rollupId } from "./rollups.js";

describe("dayKeyFor", () => {
  it("formats a UTC-noon timestamp as YYYY-MM-DD with zero-padding", () => {
    expect(dayKeyFor(Date.UTC(2026, 3, 5, 12, 0, 0))).toBe("2026-04-05");
  });
});

describe("rollupId", () => {
  it("combines profileId and day", () => {
    expect(rollupId("local", "2026-01-01")).toBe("local:2026-01-01");
  });
});

describe("computeRollups", () => {
  const day1 = Date.UTC(2026, 0, 1, 12, 0, 0);
  const day2 = Date.UTC(2026, 0, 2, 12, 0, 0);

  it("groups samples by local day and averages stressIndex within each day", () => {
    // day1: [40, 60] -> mean 50, count 2. day2: [90] -> mean 90, count 1.
    const rollups = computeRollups("local", [
      { t: day1, stressIndex: 40 },
      { t: day1, stressIndex: 60 },
      { t: day2, stressIndex: 90 },
    ]);

    expect(rollups).toHaveLength(2);
    expect(rollups[0]).toMatchObject({ day: "2026-01-01", meanStressIndex: 50, sampleCount: 2 });
    expect(rollups[1]).toMatchObject({ day: "2026-01-02", meanStressIndex: 90, sampleCount: 1 });
  });

  it("sorts output ascending by day regardless of input order", () => {
    const rollups = computeRollups("local", [
      { t: day2, stressIndex: 10 },
      { t: day1, stressIndex: 10 },
    ]);
    expect(rollups.map((r) => r.day)).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("returns an empty array for no samples", () => {
    expect(computeRollups("local", [])).toEqual([]);
  });

  it("produces ids of the form profileId:day", () => {
    const rollups = computeRollups("local", [{ t: day1, stressIndex: 50 }]);
    expect(rollups[0]?.id).toBe("local:2026-01-01");
  });
});
