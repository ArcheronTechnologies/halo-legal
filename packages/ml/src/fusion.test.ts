import type { RppgWindowResult } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { fuseRppgEstimate, isDlValidatedForCondition } from "./fusion.js";

function fakeClassicalResult(hrBpm: number): RppgWindowResult {
  return {
    method: "pos",
    layer: "classical",
    windowStart: 0,
    windowEnd: 10,
    hrBpm,
    hrv: null,
    quality: { sqi: 0.8, snrDb: 5, skewness: 0.5 },
  };
}

describe("isDlValidatedForCondition", () => {
  it("is always false today — no validation study has been run yet (ADR-0002/0006)", () => {
    const gate = isDlValidatedForCondition({ skinToneBin: 5, deviceClass: "laptop" });
    expect(gate.dlTrusted).toBe(false);
    expect(gate.reason).toContain("VALIDATION.md");
  });
});

describe("fuseRppgEstimate", () => {
  it("falls back to classical-only when there is no DL prediction", () => {
    const classical = fakeClassicalResult(70);
    const fused = fuseRppgEstimate({ classical, dl: null, condition: {} });
    expect(fused.result).toBe(classical);
    expect(fused.usedLayers).toEqual(["classical"]);
  });

  it("falls back to classical-only even with a DL prediction, because the gate is not open", () => {
    const classical = fakeClassicalResult(70);
    const fused = fuseRppgEstimate({
      classical,
      dl: { hrBpm: 95, confidence: 0.9 },
      condition: { skinToneBin: 3 },
    });
    // must equal the classical result exactly (no blending) since dlTrusted is always false today
    expect(fused.result.hrBpm).toBe(70);
    expect(fused.usedLayers).toEqual(["classical"]);
    expect(fused.gate.dlTrusted).toBe(false);
  });
});
