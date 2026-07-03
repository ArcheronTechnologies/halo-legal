import * as ort from "onnxruntime-web";

export interface DlInferenceSpikeResult {
  backend: "webgpu" | "wasm";
  meanLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  runs: number;
}

const MODEL_URL = "/ort-spike/model.onnx";
const INPUT_SHAPE = [1, 3, 72, 72];
const WARMUP_RUNS = 3;
const TIMED_RUNS = 20;

/**
 * PLAN.md §10 Phase 0 "stand up the on-device DL inference path... measure real per-frame
 * latency/CPU/GPU budget... confirm the WASM fallback works" — an acceptance criterion from the
 * original plan that Phases 0-4's actual implementation had otherwise left unaddressed. This runs
 * an UNTRAINED placeholder model (see research/rppg/dl_spike_model.py for why, and why it's
 * untrained) purely to measure real onnxruntime-web inference latency on real hardware. See
 * ARCHITECTURE.md §5.2.1 for the measured numbers and the full picture.
 *
 * This is NOT the production DL integration point — that's packages/ml/src/dlRppgModel.ts +
 * fusion.ts, built in Phase 0 and correctly, honestly gated closed (isDlValidatedForCondition
 * always returns dlTrusted: false until a real VALIDATION.md §5 study exists). This module answers
 * a narrower, purely infrastructural question — "does onnxruntime-web/WebGPU inference actually
 * work and how fast" — and is deliberately never imported by scoring/composite.ts or anything in
 * the live pipeline. Runs on the main thread (not the Worker) since it's a one-shot measurement,
 * not part of the per-frame pipeline.
 *
 * numThreads=1 avoids onnxruntime-web's multi-threaded WASM path, which needs SharedArrayBuffer
 * and therefore COOP/COEP cross-origin-isolation headers — ARCHITECTURE.md's "stay single-
 * threaded to avoid COOP/COEP" decision applies here exactly as it does to the classical pipeline.
 */
export async function runDlInferenceSpike(): Promise<DlInferenceSpikeResult> {
  ort.env.wasm.wasmPaths = "/ort-spike/";
  ort.env.wasm.numThreads = 1;

  let session: ort.InferenceSession;
  let backend: "webgpu" | "wasm";
  try {
    session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["webgpu"] });
    backend = "webgpu";
  } catch {
    session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    backend = "wasm";
  }

  // Zero-filled input: this measures inference latency for a representative op graph/tensor
  // shape, not correctness (the model is untrained — see module docstring) or real pixel data.
  const inputSize = INPUT_SHAPE.reduce((a, b) => a * b, 1);
  const feeds = { roi_patch: new ort.Tensor("float32", new Float32Array(inputSize), INPUT_SHAPE) };

  for (let i = 0; i < WARMUP_RUNS; i++) {
    await session.run(feeds);
  }

  const latencies: number[] = [];
  for (let i = 0; i < TIMED_RUNS; i++) {
    const start = performance.now();
    await session.run(feeds);
    latencies.push(performance.now() - start);
  }

  return {
    backend,
    meanLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    runs: TIMED_RUNS,
  };
}
