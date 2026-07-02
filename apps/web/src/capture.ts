/**
 * Camera capture using requestVideoFrameCallback for true per-frame timestamps (mediaTime) —
 * the concrete fix for uneven webcam frame delivery described in ARCHITECTURE.md §2.2. Falls
 * back to requestAnimationFrame + video.currentTime on browsers without rVFC support.
 */

export interface CameraStream {
  stream: MediaStream;
  video: HTMLVideoElement;
  stop: () => void;
}

export async function startCamera(video: HTMLVideoElement): Promise<CameraStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, min: 15 },
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  return {
    stream,
    video,
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
  };
}

export interface FrameEvent {
  /** Presentation timestamp, seconds, on the media timeline (mediaTime, or a rAF-based fallback). */
  mediaTimeSec: number;
}

export type FrameCallback = (event: FrameEvent) => void;

/** Starts a per-frame loop and returns a function that stops it. */
export function startFrameLoop(video: HTMLVideoElement, onFrame: FrameCallback): () => void {
  let stopped = false;

  // Read the method into a local first (rather than `"x" in video`) so a TS DOM lib that already
  // declares requestVideoFrameCallback as always-present doesn't narrow `video` itself to `never`
  // in the fallback branch below — genuine runtime feature detection still matters even when the
  // *type* assumes a modern baseline (older WebViews/browsers can still lack the API at runtime).
  const rvfc = video.requestVideoFrameCallback?.bind(video);

  if (rvfc) {
    const step = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (stopped) return;
      onFrame({ mediaTimeSec: metadata.mediaTime });
      rvfc(step);
    };
    rvfc(step);
  } else {
    const step = () => {
      if (stopped) return;
      onFrame({ mediaTimeSec: video.currentTime });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return () => {
    stopped = true;
  };
}
