import { describe, expect, it } from "vitest";
import { type BlendshapeCategory, extractTensionFeatures } from "./blendshapes.js";

function categories(overrides: Record<string, number>): BlendshapeCategory[] {
  return Object.entries(overrides).map(([categoryName, score]) => ({ categoryName, score }));
}

describe("extractTensionFeatures", () => {
  it("takes the max of left/right for brow, lid, and lip tension", () => {
    const result = extractTensionFeatures(
      categories({
        browDownLeft: 0.2,
        browDownRight: 0.7,
        eyeSquintLeft: 0.6,
        eyeSquintRight: 0.1,
        mouthPressLeft: 0.3,
        mouthPressRight: 0.3,
      }),
    );
    expect(result.browTension).toBeCloseTo(0.7);
    expect(result.lidTension).toBeCloseTo(0.6);
    expect(result.lipTension).toBeCloseTo(0.3);
  });

  it("defaults missing categories to a score of 0", () => {
    const result = extractTensionFeatures([]);
    expect(result.browTension).toBe(0);
    expect(result.lidTension).toBe(0);
    expect(result.lipTension).toBe(0);
    expect(result.blinking).toBe(false);
  });

  it("reports blinking=true only once the blink score crosses the threshold", () => {
    const below = extractTensionFeatures(
      categories({ eyeBlinkLeft: 0.4, eyeBlinkRight: 0.1 }),
      0.5,
    );
    expect(below.blinking).toBe(false);

    const above = extractTensionFeatures(
      categories({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.1 }),
      0.5,
    );
    expect(above.blinking).toBe(true);
  });

  it("respects a custom blink threshold", () => {
    const result = extractTensionFeatures(categories({ eyeBlinkLeft: 0.3 }), 0.2);
    expect(result.blinking).toBe(true);
  });
});
