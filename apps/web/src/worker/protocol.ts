import type { BehaviouralWindowResult, RppgWindowResult } from "@halo-pulse/types";

/** A landmark point sent back for the main-thread ROI overlay — deliberately just {x, y}. */
export interface OverlayPoint {
  x: number;
  y: number;
}

export interface InitMessage {
  type: "init";
  wasmBasePath: string;
  modelAssetPath: string;
}

export interface FrameMessage {
  type: "frame";
  imageBitmap: ImageBitmap;
  timestampMs: number;
}

export interface ResetMessage {
  type: "reset";
}

/** Toggles whether `frameResult` includes `landmarks` — the main thread only needs them to draw
 * the ROI overlay, so there's no reason to map + structured-clone ~468 points every face frame
 * while the overlay checkbox is off. */
export interface SetOverlayMessage {
  type: "setOverlay";
  enabled: boolean;
}

export type MainToWorkerMessage = InitMessage | FrameMessage | ResetMessage | SetOverlayMessage;

export interface ReadyMessage {
  type: "ready";
}

export interface FrameResultMessage {
  type: "frameResult";
  faceDetected: boolean;
  landmarks?: OverlayPoint[];
}

export interface WindowFeaturesMessage {
  type: "windowFeatures";
  rppg: RppgWindowResult;
  behavioural: BehaviouralWindowResult;
}

export interface WorkerErrorMessage {
  type: "error";
  message: string;
}

export type WorkerToMainMessage =
  | ReadyMessage
  | FrameResultMessage
  | WindowFeaturesMessage
  | WorkerErrorMessage;
