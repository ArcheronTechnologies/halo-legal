import type { RoiName } from "@halo-pulse/types";
import { type Point2D, pointInPolygon, polygonBoundingBox } from "./geometry.js";
import { ROI_LANDMARK_INDICES } from "./landmarks.js";

/** A minimal pixel-buffer shape compatible with both a real ImageData and plain test fixtures. */
export interface PixelBuffer {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** A minimal landmark shape compatible with MediaPipe's NormalizedLandmark ({x, y, z}). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface RgbMean {
  r: number;
  g: number;
  b: number;
  /** Number of pixels the mean was computed from — 0 means the ROI was off-frame/degenerate. */
  pixelCount: number;
}

function landmarksToPolygon(
  landmarks: NormalizedPoint[],
  indices: number[],
  width: number,
  height: number,
): Point2D[] {
  return indices.map((i) => {
    const lm = landmarks[i];
    if (!lm) throw new Error(`landmarksToPolygon: missing landmark index ${i}`);
    return { x: lm.x * width, y: lm.y * height };
  });
}

/**
 * Mean RGB over the pixels inside a landmark-defined ROI polygon (point-in-polygon test,
 * restricted to the polygon's bounding box for efficiency) — see ARCHITECTURE.md §2.3, §3.1.
 * Assumes 4 bytes/pixel RGBA layout (matches Canvas ImageData).
 */
export function computeRoiMeanRgb(
  pixels: PixelBuffer,
  landmarks: NormalizedPoint[],
  roiIndices: number[],
): RgbMean {
  const polygon = landmarksToPolygon(landmarks, roiIndices, pixels.width, pixels.height);
  const bbox = polygonBoundingBox(polygon);

  const x0 = Math.max(0, Math.floor(bbox.minX));
  const y0 = Math.max(0, Math.floor(bbox.minY));
  const x1 = Math.min(pixels.width - 1, Math.ceil(bbox.maxX));
  const y1 = Math.min(pixels.height - 1, Math.ceil(bbox.maxY));

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!pointInPolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) continue;
      const idx = (y * pixels.width + x) * 4;
      sumR += pixels.data[idx]!;
      sumG += pixels.data[idx + 1]!;
      sumB += pixels.data[idx + 2]!;
      count++;
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0, pixelCount: 0 };
  return { r: sumR / count, g: sumG / count, b: sumB / count, pixelCount: count };
}

export function computeAllRoiMeans(
  pixels: PixelBuffer,
  landmarks: NormalizedPoint[],
): Record<RoiName, RgbMean> {
  const result = {} as Record<RoiName, RgbMean>;
  for (const roiName of Object.keys(ROI_LANDMARK_INDICES) as RoiName[]) {
    result[roiName] = computeRoiMeanRgb(pixels, landmarks, ROI_LANDMARK_INDICES[roiName]);
  }
  return result;
}
