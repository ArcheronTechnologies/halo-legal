import type { RoiName } from "@halo-pulse/types";
import { ROI_LANDMARK_INDICES } from "@halo-pulse/vision";

interface NormalizedPoint {
  x: number;
  y: number;
}

/** Draws each ROI polygon (forehead/cheeks) over the video for visual sanity-checking. */
export function drawRoiOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedPoint[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(80, 220, 140, 0.9)";
  ctx.fillStyle = "rgba(80, 220, 140, 0.15)";

  for (const roiName of Object.keys(ROI_LANDMARK_INDICES) as RoiName[]) {
    const indices = ROI_LANDMARK_INDICES[roiName];
    ctx.beginPath();
    indices.forEach((idx, i) => {
      const lm = landmarks[idx];
      if (!lm) return;
      const x = lm.x * width;
      const y = lm.y * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

export function clearOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}
