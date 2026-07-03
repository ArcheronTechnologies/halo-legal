import type { RoiSample } from "@halo-pulse/types";

/**
 * The on-device deep-learning rPPG layer's public contract — see PLAN.md §2.1.1,
 * ARCHITECTURE.md §5, and ADR-0002. **No trained model ships yet.** `loadDlRppgModel` is honest
 * about that: given no `modelUrl`, or if loading fails, it resolves to `null` rather than
 * fabricating a result, and every caller (see fusion.ts) already treats `null` as "fall back to
 * classical" — the same fallback path a validation-gate failure would produce once a real model
 * exists. Producing that model is real, separate work: either training from scratch in the
 * Python harness (Contrast-Phys+ is the leading candidate — ADR-0002, ADR-0005, since it needs
 * no licensed ground-truth labels) or sourcing cleanly-licensed pretrained weights, then
 * exporting to ONNX. Track that work against the Phase 0 exit criteria in PLAN.md §10.
 */
export interface DlRppgPrediction {
  hrBpm: number;
  /** Model-reported confidence, 0-1 — separate from (and combined with) the classical-layer SQI. */
  confidence: number;
}

export interface DlRppgModel {
  readonly modelId: string;
  predict(samples: RoiSample[]): Promise<DlRppgPrediction>;
  dispose(): void;
}

export interface LoadDlRppgModelOptions {
  /** URL/path to a self-hosted ONNX model (ARCHITECTURE.md §5.1). Omit to explicitly skip loading. */
  modelUrl?: string;
  /** Preferred onnxruntime-web execution provider; falls back automatically if unavailable. */
  executionProvider?: "webgpu" | "wasm";
}

/**
 * Attempts to load the on-device DL rPPG model. Returns `null` (not a thrown error) when no
 * model is configured or loading fails — this is the expected, common case today, and callers
 * must treat it as "use the classical layer" rather than a fatal condition.
 */
export async function loadDlRppgModel(opts: LoadDlRppgModelOptions): Promise<DlRppgModel | null> {
  if (!opts.modelUrl) {
    return null;
  }

  try {
    const ort = await import("onnxruntime-web");
    const providers = opts.executionProvider ? [opts.executionProvider] : ["webgpu", "wasm"];
    const session = await ort.InferenceSession.create(opts.modelUrl, {
      executionProviders: providers,
    });

    return {
      modelId: opts.modelUrl,
      async predict(_samples: RoiSample[]): Promise<DlRppgPrediction> {
        // The actual input tensor shape (and preprocessing to match it) is defined by whichever
        // model ADR-0002's Phase 0 spike selects (TS-CAN / EfficientPhys / Contrast-Phys+) — each
        // has a different expected input. There is intentionally no fabricated inference path
        // here; wire this up once a real, exported ONNX model exists.
        throw new Error(
          "loadDlRppgModel: a session was created but no model-specific inference path is implemented yet — see ADR-0002.",
        );
      },
      dispose(): void {
        void session.release();
      },
    };
  } catch (err) {
    console.warn(
      `loadDlRppgModel: failed to load "${opts.modelUrl}", falling back to classical-only.`,
      err,
    );
    return null;
  }
}
