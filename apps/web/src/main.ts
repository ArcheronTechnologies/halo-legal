import type { Baseline, Sample } from "@halo-pulse/types";
import { CalibrationCollector } from "./calibration/collector.js";
import { finalizeCalibration } from "./calibration/runCalibration.js";
import { getGaugeElements, resetStressGauge, updateStressGauge } from "./gauge.js";
import { clearOverlay, drawRoiOverlay } from "./overlay.js";
import { type PipelineSession, startPipelineSession } from "./pipelineSession.js";
import { computeStressIndex } from "./scoring/composite.js";
import type { WindowFeatures } from "./scoring/features.js";
import { buildSessionSummary } from "./sessionSummary.js";
import { getActiveBaseline } from "./store/baselines.js";
import { db, LOCAL_PROFILE_ID } from "./store/db.js";
import { saveSession } from "./store/sessions.js";
import { grantConsent, hasConsent } from "./store/settings.js";

// Phase 1 (PLAN.md §10): consent -> calibration -> a live, baseline-relative Stress Index, with
// session summaries persisted locally. The classical rPPG + behavioural pipeline itself runs in
// the Web Worker wired up in pipelineSession.ts / worker/pipeline.worker.ts.

const CALIBRATION_DURATION_SEC = 60; // PLAN.md §6: a short guided rest recording, 60-120s
const MIN_VALID_WINDOWS = 5;
const SQI_FLOOR = 0.15; // below this, show "signal too weak" rather than a number
const GAUGE_SMOOTHING_ALPHA = 0.3; // EMA weight for the newest reading (PLAN.md §6: smoothed index)

// --- DOM ---
const consentScreen = document.getElementById("consentScreen") as HTMLElement;
const calibrationScreen = document.getElementById("calibrationScreen") as HTMLElement;
const mainScreen = document.getElementById("mainScreen") as HTMLElement;

const consentBtn = document.getElementById("consentBtn") as HTMLButtonElement;

const calibrationVideo = document.getElementById("calibrationVideo") as HTMLVideoElement;
const calibrationStatusEl = document.getElementById("calibrationStatus") as HTMLElement;
const calibrationProgressEl = document.getElementById("calibrationProgress") as HTMLDivElement;
const calibrationCancelBtn = document.getElementById("calibrationCancelBtn") as HTMLButtonElement;

const videoEl = document.getElementById("video") as HTMLVideoElement;
const overlayEl = document.getElementById("overlay") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLElement;
const hrEl = document.getElementById("hr") as HTMLElement;
const sqiEl = document.getElementById("sqi") as HTMLElement;
const methodEl = document.getElementById("method") as HTMLElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const recalibrateBtn = document.getElementById("recalibrateBtn") as HTMLButtonElement;
const overlayToggle = document.getElementById("overlayToggle") as HTMLInputElement;

const overlayCtx = overlayEl.getContext("2d") as CanvasRenderingContext2D;
const gaugeElements = getGaugeElements(document);

type Screen = "consent" | "calibration" | "main";
function showScreen(screen: Screen): void {
  consentScreen.hidden = screen !== "consent";
  calibrationScreen.hidden = screen !== "calibration";
  mainScreen.hidden = screen !== "main";
}

// --- Boot: figure out which screen to show first ---
async function boot(): Promise<void> {
  if (!(await hasConsent(db))) {
    showScreen("consent");
    return;
  }
  const baseline = await getActiveBaseline(db, LOCAL_PROFILE_ID);
  if (!baseline) {
    showScreen("calibration");
    startCalibration();
    return;
  }
  showScreen("main");
}

consentBtn.addEventListener("click", () => {
  grantConsent(db, Date.now())
    .then(() => getActiveBaseline(db, LOCAL_PROFILE_ID))
    .then((baseline) => {
      if (baseline) {
        showScreen("main");
      } else {
        showScreen("calibration");
        startCalibration();
      }
    })
    .catch((err) => console.error("consent flow failed:", err));
});

// --- Calibration screen ---
let calibrationSession: PipelineSession | null = null;
let calibrationTimer: ReturnType<typeof setInterval> | null = null;

function stopCalibrationSession(): void {
  if (calibrationTimer) clearInterval(calibrationTimer);
  calibrationTimer = null;
  calibrationSession?.stop();
  calibrationSession = null;
}

function startCalibration(): void {
  const collector = new CalibrationCollector(MIN_VALID_WINDOWS);
  const startedAtMs = Date.now();
  calibrationStatusEl.textContent = "Requesting camera...";
  calibrationProgressEl.style.width = "0%";

  startPipelineSession(calibrationVideo, {
    onFaceStatus: (detected) => {
      calibrationStatusEl.textContent = detected
        ? `Face detected — hold still (${collector.windowCount} readings so far)`
        : "No face detected — please face the camera";
    },
    onWindowFeatures: (features) => {
      collector.addWindow(features);
    },
    onError: (message) => console.warn("calibration pipeline error:", message),
  })
    .then((session) => {
      calibrationSession = session;
      calibrationTimer = setInterval(() => {
        const elapsedSec = (Date.now() - startedAtMs) / 1000;
        const pct = Math.min(100, (elapsedSec / CALIBRATION_DURATION_SEC) * 100);
        calibrationProgressEl.style.width = `${pct}%`;
        if (elapsedSec >= CALIBRATION_DURATION_SEC) {
          finishCalibration(collector);
        }
      }, 500);
    })
    .catch((err) => {
      calibrationStatusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    });
}

function finishCalibration(collector: CalibrationCollector): void {
  stopCalibrationSession();
  const result = collector.finish();

  finalizeCalibration(result, { db, profileId: LOCAL_PROFILE_ID, capturedAt: Date.now() })
    .then((outcome) => {
      if (!outcome.success) {
        calibrationStatusEl.textContent = `${outcome.reason} Retrying...`;
        setTimeout(startCalibration, 3000);
        return;
      }
      showScreen("main");
    })
    .catch((err) => {
      calibrationStatusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    });
}

calibrationCancelBtn.addEventListener("click", async () => {
  stopCalibrationSession();
  const baseline = await getActiveBaseline(db, LOCAL_PROFILE_ID);
  showScreen(baseline ? "main" : "consent");
});

// --- Main / live session screen ---
let liveSession: PipelineSession | null = null;
let sessionSamples: Sample[] = [];
let sessionId = "";
let sessionStartedAtMs = 0;
let smoothedIndex: number | null = null;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

async function startLive(): Promise<void> {
  const baseline = await getActiveBaseline(db, LOCAL_PROFILE_ID);
  if (!baseline) {
    setStatus("No baseline — please calibrate first");
    return;
  }

  startBtn.disabled = true;
  setStatus("Requesting camera...");
  sessionSamples = [];
  sessionId = crypto.randomUUID();
  smoothedIndex = null;

  try {
    liveSession = await startPipelineSession(videoEl, {
      onFaceStatus: (detected, landmarks) => {
        setStatus(detected ? "Face detected" : "No face detected");
        if (overlayToggle.checked && landmarks) {
          drawRoiOverlay(overlayCtx, landmarks, overlayEl.width, overlayEl.height);
        } else {
          clearOverlay(overlayCtx, overlayEl.width, overlayEl.height);
        }
      },
      onWindowFeatures: (features, raw) => {
        handleLiveWindow(features, raw.rppg.method, raw.rppg.layer, baseline);
      },
      onError: (message) => console.warn("live pipeline error:", message),
    });
  } catch (err) {
    setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    startBtn.disabled = false;
    return;
  }

  overlayEl.width = videoEl.videoWidth || 640;
  overlayEl.height = videoEl.videoHeight || 480;
  sessionStartedAtMs = Date.now();
  stopBtn.disabled = false;
}

function handleLiveWindow(
  features: WindowFeatures,
  method: string,
  layer: "classical" | "dl",
  baseline: Baseline,
): void {
  methodEl.textContent = layer === "dl" ? `${method} (DL-assisted)` : method;

  if (features.sqi < SQI_FLOOR) {
    hrEl.textContent = "--";
    sqiEl.textContent = `${features.sqi.toFixed(2)} (signal too weak)`;
    return;
  }

  hrEl.textContent = features.hr.toFixed(0);
  sqiEl.textContent = features.sqi.toFixed(2);

  const stressResult = computeStressIndex(features, baseline);
  smoothedIndex =
    smoothedIndex === null
      ? stressResult.stressIndex
      : GAUGE_SMOOTHING_ALPHA * stressResult.stressIndex +
        (1 - GAUGE_SMOOTHING_ALPHA) * smoothedIndex;
  updateStressGauge(gaugeElements, smoothedIndex, stressResult.band);

  sessionSamples.push({
    id: crypto.randomUUID(),
    sessionId,
    t: Date.now(),
    hr: features.hr,
    rmssd: features.rmssd ?? undefined,
    sdnn: features.sdnn ?? undefined,
    lfhf: features.lfhf ?? undefined,
    behavioural: {
      blinkDeviation: features.blinkRateHz - baseline.blinkRateMean,
      browTension: features.browTension,
      lidTension: features.lidTension,
      lipTension: features.lipTension,
    },
    sqi: features.sqi,
    stressIndex: stressResult.stressIndex,
    confidence: stressResult.confidence,
  });
}

function stopLive(): void {
  liveSession?.stop();
  liveSession = null;

  if (sessionSamples.length > 0) {
    getActiveBaseline(db, LOCAL_PROFILE_ID)
      .then((baseline) => {
        const summary = buildSessionSummary(sessionSamples, {
          id: sessionId,
          profileId: LOCAL_PROFILE_ID,
          baselineId: baseline?.id ?? "unknown",
          startedAt: sessionStartedAtMs,
          endedAt: Date.now(),
          signalLayers: ["classical"],
        });
        return saveSession(db, summary, sessionSamples);
      })
      .catch((err) => console.error("failed to save session:", err));
  }

  clearOverlay(overlayCtx, overlayEl.width, overlayEl.height);
  setStatus("Stopped");
  hrEl.textContent = "--";
  sqiEl.textContent = "--";
  methodEl.textContent = "--";
  resetStressGauge(gaugeElements, "Session stopped");
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", () => {
  startLive().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    startBtn.disabled = false;
  });
});
stopBtn.addEventListener("click", stopLive);

recalibrateBtn.addEventListener("click", () => {
  if (liveSession) stopLive();
  showScreen("calibration");
  startCalibration();
});

boot().catch((err) => {
  console.error("boot failed:", err);
  setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
});
