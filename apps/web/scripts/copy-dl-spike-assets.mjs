// Copies the onnxruntime-web runtime + the placeholder ONNX model into public/ort-spike/ so both
// are served self-hosted (PLAN.md §7: no CDN fetches), matching how MediaPipe's WASM+model are
// vendored. See research/scripts/export_dl_rppg_latency_spike.py for the model's provenance.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ORT_DIST = join(import.meta.dirname, "..", "node_modules", "onnxruntime-web", "dist");
const OUT_DIR = join(import.meta.dirname, "..", "public", "ort-spike");
const MODEL_SRC = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "research",
  "fixtures",
  "dl_rppg_latency_spike.onnx",
);

// The unified simd+threaded wasm binary also supports single-threaded execution (ort.env.wasm.
// numThreads = 1, set in dlInferenceSpike.ts) without requiring SharedArrayBuffer/COOP+COEP —
// ARCHITECTURE.md's "stay single-threaded to avoid COOP/COEP" constraint, so no cross-origin
// isolation headers are needed for either the WASM or WebGPU execution provider.
const FILES = [
  "ort.min.mjs",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

mkdirSync(OUT_DIR, { recursive: true });
for (const file of FILES) {
  const src = join(ORT_DIST, file);
  if (!existsSync(src)) {
    console.warn(`Skipping missing onnxruntime-web asset: ${file}`);
    continue;
  }
  copyFileSync(src, join(OUT_DIR, file));
}

if (!existsSync(MODEL_SRC)) {
  console.error(
    `Missing ${MODEL_SRC} — run: python3 research/scripts/export_dl_rppg_latency_spike.py`,
  );
  process.exit(1);
}
copyFileSync(MODEL_SRC, join(OUT_DIR, "model.onnx"));

console.log(`Copied onnxruntime-web runtime + placeholder model to ${OUT_DIR}`);
