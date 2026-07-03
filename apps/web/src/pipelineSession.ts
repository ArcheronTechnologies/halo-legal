import type { BehaviouralWindowResult, RppgWindowResult } from "@halo-pulse/types";
import { startCamera, startFrameLoop } from "./capture.js";
import { buildWindowFeatures, type WindowFeatures } from "./scoring/features.js";
import type { MainToWorkerMessage, OverlayPoint, WorkerToMainMessage } from "./worker/protocol.js";

export interface PipelineSessionCallbacks {
  onFaceStatus: (detected: boolean, landmarks?: OverlayPoint[]) => void;
  onWindowFeatures: (
    features: WindowFeatures,
    raw: { rppg: RppgWindowResult; behavioural: BehaviouralWindowResult },
  ) => void;
  onError: (message: string) => void;
}

export interface PipelineSession {
  stop: () => void;
  /** Forwards to the worker's SetOverlayMessage — see pipeline.worker.ts's `emitLandmarks`. */
  setOverlayEnabled: (enabled: boolean) => void;
}

/**
 * The camera + Worker lifecycle shared by both the calibration screen and the live-session
 * screen (ARCHITECTURE.md §1, §9) — everything from here down to the classical rPPG pipeline is
 * identical between the two; only what the caller *does* with each window's features differs
 * (accumulate into a baseline vs. score against one), which is why that decision is left to the
 * caller via `onWindowFeatures` rather than baked in here.
 */
export async function startPipelineSession(
  videoEl: HTMLVideoElement,
  callbacks: PipelineSessionCallbacks,
): Promise<PipelineSession> {
  const camera = await startCamera(videoEl);

  // See main.ts's original comment (preserved there) for why this is a plain-URL classic worker,
  // not `new URL("./worker/...ts", import.meta.url), { type: "module" }`.
  const worker = new Worker("/generated/pipeline.worker.js");
  let workerReady = false;
  let bitmapInFlight = false;

  worker.onmessage = (ev: MessageEvent<WorkerToMainMessage>) => {
    const msg = ev.data;
    switch (msg.type) {
      case "ready":
        workerReady = true;
        break;
      case "frameResult":
        callbacks.onFaceStatus(msg.faceDetected, msg.landmarks);
        break;
      case "windowFeatures": {
        const features = buildWindowFeatures(msg.rppg, msg.behavioural);
        callbacks.onWindowFeatures(features, { rppg: msg.rppg, behavioural: msg.behavioural });
        break;
      }
      case "error":
        callbacks.onError(msg.message);
        break;
    }
  };
  worker.onerror = (ev) => callbacks.onError(`worker crashed: ${ev.message}`);

  const post = (message: MainToWorkerMessage, transfer: Transferable[] = []): void => {
    worker.postMessage(message, transfer);
  };
  post({
    type: "init",
    wasmBasePath: "/models/wasm",
    modelAssetPath: "/models/face_landmarker.task",
  });

  const stopFrameLoop = startFrameLoop(videoEl, ({ mediaTimeSec }) => {
    if (!workerReady || bitmapInFlight) return;
    bitmapInFlight = true;
    createImageBitmap(videoEl)
      .then((bitmap) => {
        post({ type: "frame", imageBitmap: bitmap, timestampMs: mediaTimeSec * 1000 }, [bitmap]);
      })
      .catch((err) =>
        callbacks.onError(
          `createImageBitmap failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
      .finally(() => {
        bitmapInFlight = false;
      });
  });

  return {
    stop: () => {
      stopFrameLoop();
      camera.stop();
      worker.terminate();
    },
    setOverlayEnabled: (enabled: boolean) => {
      post({ type: "setOverlay", enabled });
    },
  };
}
