import type { RppgCombinerMethod } from "@halo-pulse/dsp";
import { processRoiWindow } from "@halo-pulse/dsp";
import {
  computeRoiMeanRgb,
  createFaceLandmarker,
  extractTensionFeatures,
  ROI_LANDMARK_INDICES,
} from "@halo-pulse/vision";
import { startCamera, startFrameLoop } from "./capture.js";
import { clearOverlay, drawRoiOverlay } from "./overlay.js";
import { RollingRoiBuffer } from "./rollingBuffer.js";

// This is the Phase 0 spike (PLAN.md §10): webcam -> face landmarks -> forehead ROI -> a live,
// naive heart-rate readout, running entirely on the main thread for simplicity. Moving vision +
// DSP into a Web Worker (ARCHITECTURE.md §1, §9) is the documented next step for Phase 1, once
// this pipeline is proven correct — not yet done here.

const WINDOW_SEC = 12; // rolling buffer length fed into the rPPG pipeline
const MIN_WINDOW_SEC = 8; // don't attempt an HR estimate until this much data has accumulated
const PROCESS_INTERVAL_MS = 2000;
const SQI_FLOOR = 0.15; // below this, show "signal too weak" rather than a number
const METHOD: RppgCombinerMethod = "pos";

const videoEl = document.getElementById("video") as HTMLVideoElement;
const overlayEl = document.getElementById("overlay") as HTMLCanvasElement;
const statusEl = document.getElementById("status")!;
const hrEl = document.getElementById("hr")!;
const sqiEl = document.getElementById("sqi")!;
const methodEl = document.getElementById("method")!;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const overlayToggle = document.getElementById("overlayToggle") as HTMLInputElement;

methodEl.textContent = METHOD;

const overlayCtx = overlayEl.getContext("2d")!;
const pixelCanvas = document.createElement("canvas");
const pixelCtx = pixelCanvas.getContext("2d", { willReadFrequently: true })!;

let stopFrameLoop: (() => void) | null = null;
let stopCameraFn: (() => void) | null = null;
let processTimer: ReturnType<typeof setInterval> | null = null;
let framesSinceFace = 0;

const buffer = new RollingRoiBuffer(WINDOW_SEC);

function setStatus(text: string): void {
  statusEl.textContent = text;
}

async function start(): Promise<void> {
  startBtn.disabled = true;
  setStatus("Requesting camera...");

  const camera = await startCamera(videoEl);
  stopCameraFn = camera.stop;

  setStatus("Loading face model...");
  const landmarker = await createFaceLandmarker({
    wasmBasePath: "/models/wasm",
    modelAssetPath: "/models/face_landmarker.task",
    delegate: "GPU",
    numFaces: 1,
  });

  const width = videoEl.videoWidth || 640;
  const height = videoEl.videoHeight || 480;
  pixelCanvas.width = width;
  pixelCanvas.height = height;
  overlayEl.width = width;
  overlayEl.height = height;

  setStatus("Looking for a face...");
  stopBtn.disabled = false;

  stopFrameLoop = startFrameLoop(videoEl, ({ mediaTimeSec }) => {
    const timestampMs = mediaTimeSec * 1000;
    const result = landmarker.detectForVideo(videoEl, timestampMs);
    const landmarks = result.faceLandmarks[0];

    if (!landmarks) {
      framesSinceFace++;
      if (framesSinceFace > 30) {
        setStatus("No face detected");
        if (overlayToggle.checked) clearOverlay(overlayCtx, overlayEl.width, overlayEl.height);
      }
      return;
    }
    framesSinceFace = 0;
    setStatus("Face detected");

    pixelCtx.drawImage(videoEl, 0, 0, width, height);
    const imageData = pixelCtx.getImageData(0, 0, width, height);

    const blendshapeCategories = result.faceBlendshapes[0]?.categories ?? [];
    const tension = extractTensionFeatures(blendshapeCategories);

    if (!tension.blinking) {
      const forehead = computeRoiMeanRgb(imageData, landmarks, ROI_LANDMARK_INDICES.forehead);
      if (forehead.pixelCount > 0) {
        buffer.push({ t: mediaTimeSec, r: forehead.r, g: forehead.g, b: forehead.b });
      }
    }

    if (overlayToggle.checked) {
      drawRoiOverlay(overlayCtx, landmarks, overlayEl.width, overlayEl.height);
    } else {
      clearOverlay(overlayCtx, overlayEl.width, overlayEl.height);
    }
  });

  processTimer = setInterval(runPipeline, PROCESS_INTERVAL_MS);
}

function runPipeline(): void {
  if (buffer.durationSec < MIN_WINDOW_SEC) {
    hrEl.textContent = "--";
    sqiEl.textContent = `warming up (${buffer.durationSec.toFixed(0)}s/${MIN_WINDOW_SEC}s)`;
    return;
  }

  try {
    const result = processRoiWindow(buffer.snapshot(), { fs: 30, method: METHOD });
    if (result.quality.sqi < SQI_FLOOR) {
      hrEl.textContent = "--";
      sqiEl.textContent = `${result.quality.sqi.toFixed(2)} (signal too weak)`;
    } else {
      hrEl.textContent = result.hrBpm.toFixed(0);
      sqiEl.textContent = result.quality.sqi.toFixed(2);
    }
  } catch (err) {
    hrEl.textContent = "--";
    sqiEl.textContent = "insufficient signal";
    console.warn("processRoiWindow failed:", err);
  }
}

function stop(): void {
  stopFrameLoop?.();
  stopFrameLoop = null;
  stopCameraFn?.();
  stopCameraFn = null;
  if (processTimer) clearInterval(processTimer);
  processTimer = null;

  clearOverlay(overlayCtx, overlayEl.width, overlayEl.height);
  setStatus("Stopped");
  hrEl.textContent = "--";
  sqiEl.textContent = "--";
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", () => {
  start().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    startBtn.disabled = false;
  });
});

stopBtn.addEventListener("click", stop);
