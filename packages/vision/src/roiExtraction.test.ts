import type { RoiName } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { ROI_LANDMARK_INDICES } from "./landmarks.js";
import { computeAllRoiMeans, computeRoiMeanRgb, type PixelBuffer } from "./roiExtraction.js";

/** Builds a 10x10 RGBA buffer: a solid-color square from pixel (2,2) to (7,7), black elsewhere. */
function buildTestImage(color: { r: number; g: number; b: number }): PixelBuffer {
  const width = 10;
  const height = 10;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const inSquare = x >= 2 && x <= 7 && y >= 2 && y <= 7;
      data[idx] = inSquare ? color.r : 0;
      data[idx + 1] = inSquare ? color.g : 0;
      data[idx + 2] = inSquare ? color.b : 0;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("computeRoiMeanRgb", () => {
  const color = { r: 200, g: 100, b: 50 };
  const image = buildTestImage(color);
  // normalized (0-1) landmark corners at pixel (2,2)-(8,2)-(8,8)-(2,8), enclosing pixel columns/rows 2..7
  const landmarks = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];

  it("computes the exact mean color of a uniform ROI region", () => {
    const result = computeRoiMeanRgb(image, landmarks, [0, 1, 2, 3]);
    expect(result.r).toBeCloseTo(color.r, 6);
    expect(result.g).toBeCloseTo(color.g, 6);
    expect(result.b).toBeCloseTo(color.b, 6);
    expect(result.pixelCount).toBe(36); // 6x6 region
  });

  it("returns zero pixelCount for a polygon entirely off-frame", () => {
    const offFrameLandmarks = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ];
    const result = computeRoiMeanRgb(image, offFrameLandmarks, [0, 1, 2, 3]);
    expect(result.pixelCount).toBe(0);
  });

  it("throws if a referenced landmark index does not exist", () => {
    expect(() => computeRoiMeanRgb(image, landmarks, [0, 1, 99])).toThrow();
  });
});

describe("computeAllRoiMeans", () => {
  it("produces a result for every defined ROI without throwing, for a full-size landmark set", () => {
    // 478 landmarks (468 mesh + 10 iris), arbitrary but in-bounds normalized positions, so this
    // also catches any ROI_LANDMARK_INDICES entry that references an out-of-range index.
    const landmarks = Array.from({ length: 478 }, (_, i) => ({
      x: (i % 10) / 10,
      y: (Math.floor(i / 10) % 10) / 10,
    }));
    const image: PixelBuffer = { data: new Uint8ClampedArray(20 * 20 * 4), width: 20, height: 20 };
    const result = computeAllRoiMeans(image, landmarks);
    for (const roiName of Object.keys(ROI_LANDMARK_INDICES) as RoiName[]) {
      expect(result[roiName]).toBeDefined();
    }
  });
});
