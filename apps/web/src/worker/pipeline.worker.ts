/// <reference lib="webworker" />

import { processRoiWindow } from "@halo-pulse/dsp";
import type { BehaviouralSample, RoiSample } from "@halo-pulse/types";
import {
  computeBehaviouralWindow,
  computeRoiMeanRgb,
  createFaceLandmarker,
  extractTensionFeatures,
  ROI_LANDMARK_INDICES,
} from "@halo-pulse/vision";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type {
  FrameMessage,
  InitMessage,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./protocol.js";

/**
 * Vision + DSP now run here, off the main thread (ARCHITECTURE.md §1, §9) — the main thread owns
 * only the camera/video/UI and transfers each frame as an ImageBitmap. This worker owns the
 * MediaPipe instance, the rolling ROI/behavioural buffers, and the periodic classical rPPG
 * pipeline; it posts back lightweight per-frame overlay data and, periodically, a full window's
 * features. Scoring against a baseline and persistence stay on the main thread (ARCHITECTURE.md's
 * own tree keeps `scoring/` and `store/` as app-level, not pipeline, concerns).
 */

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const WINDOW_SEC = 12;
const MIN_WINDOW_SEC = 8;
const PROCESS_INTERVAL_MS = 2000;
const FACE_LOST_FRAME_THRESHOLD = 30;

let landmarker: FaceLandmarker | null = null;
let pixelCanvas: OffscreenCanvas | null = null;
let pixelCtx: OffscreenCanvasRenderingContext2D | null = null;

let roiBuffer: RoiSample[] = [];
let behaviouralBuffer: BehaviouralSample[] = [];
let framesSinceFace = 0;
// The main thread only consumes landmarks to draw the ROI overlay — skip the per-frame map +
// structured-clone of ~468 points while it's off (see SetOverlayMessage in protocol.ts).
let emitLandmarks = true;

function post(message: WorkerToMainMessage): void {
  ctx.postMessage(message);
}

function pushWithEviction<T extends { t: number }>(
  buffer: T[],
  sample: T,
  maxDurationSec: number,
): void {
  buffer.push(sample);
  const cutoff = sample.t - maxDurationSec;
  while (buffer.length > 0 && buffer[0]!.t < cutoff) buffer.shift();
}

async function handleInit(msg: InitMessage): Promise<void> {
  try {
    landmarker = await createFaceLandmarker({
      wasmBasePath: msg.wasmBasePath,
      modelAssetPath: msg.modelAssetPath,
      delegate: "GPU",
      numFaces: 1,
    });
    post({ type: "ready" });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
}

function handleFrame(msg: FrameMessage): void {
  const { imageBitmap, timestampMs } = msg;

  if (!landmarker) {
    imageBitmap.close();
    return;
  }

  try {
    const result = landmarker.detectForVideo(imageBitmap, timestampMs);
    const landmarks = result.faceLandmarks[0];

    if (!landmarks) {
      framesSinceFace++;
      if (framesSinceFace > FACE_LOST_FRAME_THRESHOLD) {
        post({ type: "frameResult", faceDetected: false });
      }
      return;
    }
    framesSinceFace = 0;

    const blendshapeCategories = result.faceBlendshapes[0]?.categories ?? [];
    const tension = extractTensionFeatures(blendshapeCategories);
    const tSec = timestampMs / 1000;

    pushWithEviction(
      behaviouralBuffer,
      {
        t: tSec,
        browTension: tension.browTension,
        lidTension: tension.lidTension,
        lipTension: tension.lipTension,
        blinking: tension.blinking,
      },
      WINDOW_SEC,
    );

    // Building the full-frame pixel buffer is the most expensive part of this handler — only do
    // it when the ROI will actually be read (never on a blink frame).
    if (!tension.blinking) {
      if (
        !pixelCanvas ||
        pixelCanvas.width !== imageBitmap.width ||
        pixelCanvas.height !== imageBitmap.height
      ) {
        pixelCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        pixelCtx = pixelCanvas.getContext("2d", { willReadFrequently: true });
      }
      pixelCtx?.drawImage(imageBitmap, 0, 0);
      const imageData = pixelCtx?.getImageData(0, 0, imageBitmap.width, imageBitmap.height);

      if (imageData) {
        const forehead = computeRoiMeanRgb(imageData, landmarks, ROI_LANDMARK_INDICES.forehead);
        if (forehead.pixelCount > 0) {
          pushWithEviction(
            roiBuffer,
            { t: tSec, r: forehead.r, g: forehead.g, b: forehead.b },
            WINDOW_SEC,
          );
        }
      }
    }

    post({
      type: "frameResult",
      faceDetected: true,
      ...(emitLandmarks ? { landmarks: landmarks.map((l) => ({ x: l.x, y: l.y })) } : {}),
    });
  } finally {
    // ImageBitmaps are transferred, not cloned — the worker owns and must release this one.
    imageBitmap.close();
  }
}

function tryComputeWindow(): void {
  if (roiBuffer.length < 2 || behaviouralBuffer.length === 0) return;
  const durationSec = roiBuffer[roiBuffer.length - 1]!.t - roiBuffer[0]!.t;
  if (durationSec < MIN_WINDOW_SEC) return;

  try {
    const rppg = processRoiWindow([...roiBuffer], { fs: 30 });
    const behavioural = computeBehaviouralWindow([...behaviouralBuffer]);
    post({ type: "windowFeatures", rppg, behavioural });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
}

function handleReset(): void {
  roiBuffer = [];
  behaviouralBuffer = [];
  framesSinceFace = 0;
}

ctx.onmessage = (ev: MessageEvent<MainToWorkerMessage>) => {
  const msg = ev.data;
  switch (msg.type) {
    case "init":
      void handleInit(msg);
      break;
    case "frame":
      handleFrame(msg);
      break;
    case "reset":
      handleReset();
      break;
    case "setOverlay":
      emitLandmarks = msg.enabled;
      break;
  }
};

setInterval(tryComputeWindow, PROCESS_INTERVAL_MS);
