#!/usr/bin/env node
/**
 * Vendors the MediaPipe WASM runtime + face_landmarker model into public/models/ so the app can
 * self-host them (ARCHITECTURE.md §3, §10: never load from a CDN at runtime — it breaks both the
 * privacy model and offline PWA use). These are large binaries (~36 MB) and are deliberately NOT
 * committed to git (see .gitignore) — this script is the reproducible way to (re)populate them,
 * the same way a project would vendor any large model weight. Run via `pnpm setup:assets`.
 */
import { copyFileSync, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicModelsDir = join(__dirname, "..", "public", "models");
const wasmOutDir = join(publicModelsDir, "wasm");

// pnpm gives each workspace package its own node_modules with symlinks to only its declared
// deps — @mediapipe/tasks-vision is a dependency of packages/vision (not the repo root or
// apps/web), so it's only resolvable from there.
const WASM_SOURCE_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "packages",
  "vision",
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_OUT_PATH = join(publicModelsDir, "face_landmarker.task");

async function fetchModel() {
  if (existsSync(MODEL_OUT_PATH)) {
    console.log("face_landmarker.task already present, skipping download.");
    return;
  }
  console.log(`Downloading ${MODEL_URL} ...`);
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download face_landmarker.task: HTTP ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(MODEL_OUT_PATH));
  console.log("Downloaded face_landmarker.task");
}

function copyWasmRuntime() {
  mkdirSync(wasmOutDir, { recursive: true });
  for (const file of WASM_FILES) {
    const src = join(WASM_SOURCE_DIR, file);
    const dest = join(wasmOutDir, file);
    if (!existsSync(src)) {
      throw new Error(
        `Missing ${src} — is @mediapipe/tasks-vision installed? (pnpm install at the repo root)`,
      );
    }
    copyFileSync(src, dest);
  }
  console.log(`Copied ${WASM_FILES.length} MediaPipe WASM runtime files to ${wasmOutDir}`);
}

mkdirSync(publicModelsDir, { recursive: true });
copyWasmRuntime();
await fetchModel();
console.log("MediaPipe assets ready.");
