import type { RoiName } from "@halo-pulse/types";

/**
 * Landmark-index polygons for the MediaPipe 468-point canonical face mesh, defining the
 * forehead and cheek ROIs — see ARCHITECTURE.md §3.1 and PLAN.md §2.1. These anchor points
 * (forehead center 10; right cheek 234/205/50; left cheek 454/425/280) are the commonly-published
 * community reference indices for these regions; ARCHITECTURE.md is explicit that such maps are
 * a *starting point* to validate visually with the ROI overlay once real capture is available,
 * not a guaranteed-precise anatomical boundary. A handful of points around each anchor form a
 * small polygon rather than a single pixel, so per-frame noise in any one landmark averages out.
 */
export const ROI_LANDMARK_INDICES: Record<RoiName, number[]> = {
  forehead: [109, 10, 338, 337, 151, 108],
  rightCheek: [234, 227, 205, 187, 123, 50],
  leftCheek: [454, 447, 425, 411, 352, 280],
};

/** MediaPipe Face Landmarker blendshape category names this package reads — see ARCHITECTURE.md §3.2. */
export const BLENDSHAPE_NAMES = {
  browDownLeft: "browDownLeft",
  browDownRight: "browDownRight",
  eyeSquintLeft: "eyeSquintLeft",
  eyeSquintRight: "eyeSquintRight",
  mouthPressLeft: "mouthPressLeft",
  mouthPressRight: "mouthPressRight",
  eyeBlinkLeft: "eyeBlinkLeft",
  eyeBlinkRight: "eyeBlinkRight",
} as const;
