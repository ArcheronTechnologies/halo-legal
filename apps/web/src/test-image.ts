import { computeAllRoiMeans, extractTensionFeatures } from "@halo-pulse/vision";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { drawRoiOverlay } from "./overlay.js";

// Diagnostic-only page: proves the self-hosted MediaPipe model performs real face-landmark
// detection (IMAGE mode, not the app's normal VIDEO mode) without needing a live webcam, and
// exercises the same ROI/blendshape extraction code the real capture pipeline uses.

const imgEl = document.getElementById("sourceImage") as HTMLImageElement;
const overlayEl = document.getElementById("overlay") as HTMLCanvasElement;
const outputEl = document.getElementById("output")!;

const params = new URLSearchParams(location.search);
const src = params.get("src") ?? "/test-fixtures/portrait-public-domain.jpg";

function log(line: string): void {
  outputEl.textContent += `${line}\n`;
}

async function main(): Promise<void> {
  log(`Using image: ${src} (override with ?src=<url-or-path>)`);
  imgEl.src = src;
  await imgEl.decode();

  overlayEl.width = imgEl.naturalWidth;
  overlayEl.height = imgEl.naturalHeight;

  log(`Loaded image: ${imgEl.naturalWidth}x${imgEl.naturalHeight}`);
  log("Loading FaceLandmarker (IMAGE mode, self-hosted assets)...");

  const vision = await FilesetResolver.forVisionTasks("/models/wasm");
  const landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" },
    runningMode: "IMAGE",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });

  const t0 = performance.now();
  const result = landmarker.detect(imgEl);
  const elapsedMs = performance.now() - t0;

  log(`detect() took ${elapsedMs.toFixed(1)} ms`);
  log(`Faces detected: ${result.faceLandmarks.length}`);

  const landmarks = result.faceLandmarks[0];
  if (!landmarks) {
    log("FAIL: no face detected in the test image.");
    return;
  }

  log(`Landmark count: ${landmarks.length} (expect 478: 468 mesh + 10 iris)`);
  log(`Sample landmark [10] (forehead-anchor): ${JSON.stringify(landmarks[10])}`);
  log(`Sample landmark [234] (right-cheek-anchor): ${JSON.stringify(landmarks[234])}`);

  const blendshapeCategories = result.faceBlendshapes[0]?.categories ?? [];
  log(`Blendshape categories: ${blendshapeCategories.length} (expect 52)`);
  const tension = extractTensionFeatures(blendshapeCategories);
  log(`Tension features: ${JSON.stringify(tension)}`);

  // Draw the image into an offscreen canvas to read real pixel data for the ROI means.
  const pixelCanvas = document.createElement("canvas");
  pixelCanvas.width = imgEl.naturalWidth;
  pixelCanvas.height = imgEl.naturalHeight;
  const pixelCtx = pixelCanvas.getContext("2d")!;
  pixelCtx.drawImage(imgEl, 0, 0);
  const imageData = pixelCtx.getImageData(0, 0, pixelCanvas.width, pixelCanvas.height);

  const roiMeans = computeAllRoiMeans(imageData, landmarks);
  log(`ROI means: ${JSON.stringify(roiMeans, null, 2)}`);

  const overlayCtx = overlayEl.getContext("2d")!;
  drawRoiOverlay(overlayCtx, landmarks, overlayEl.width, overlayEl.height);

  const allRoisHavePixels = Object.values(roiMeans).every((m) => m.pixelCount > 0);
  log(
    allRoisHavePixels
      ? "PASS: every ROI landed on-frame with a non-zero pixel count."
      : "FAIL: at least one ROI had zero pixels (off-frame or degenerate polygon).",
  );
}

main().catch((err) => {
  log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
});
