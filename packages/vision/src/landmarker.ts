import { FaceLandmarker, FilesetResolver, type ImageSource } from "@mediapipe/tasks-vision";

export interface CreateFaceLandmarkerOptions {
  /**
   * Base path to the self-hosted MediaPipe WASM runtime (ARCHITECTURE.md §3: never load from a
   * CDN — third-party network calls at runtime break both the privacy model and offline PWA use).
   */
  wasmBasePath: string;
  /** URL/path to the self-hosted `face_landmarker.task` model asset. */
  modelAssetPath: string;
  delegate?: "GPU" | "CPU";
  numFaces?: number;
}

/**
 * Thin wrapper around MediaPipe's FaceLandmarker task (ARCHITECTURE.md §3). This module is a
 * browser-only integration (it drives real WASM/GPU inference) and is exercised by apps/web +
 * its Playwright checks rather than by this package's unit tests — see roiExtraction.ts and
 * blendshapes.ts for the pure, unit-tested logic that consumes this wrapper's output.
 */
export async function createFaceLandmarker(
  opts: CreateFaceLandmarkerOptions,
): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(opts.wasmBasePath);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: opts.modelAssetPath,
      delegate: opts.delegate ?? "GPU",
    },
    runningMode: "VIDEO",
    numFaces: opts.numFaces ?? 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });
}

export function detectForVideoFrame(
  landmarker: FaceLandmarker,
  frame: ImageSource,
  timestampMs: number,
) {
  return landmarker.detectForVideo(frame, timestampMs);
}

export type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
