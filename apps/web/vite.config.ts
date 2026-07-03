import { join } from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { rawStaticAssetsPlugin } from "./viteRawStaticAssets.js";

// publicDir is disabled in favor of rawStaticAssetsPlugin — see that file's docstring for why:
// Vite's built-in publicDir serving refuses requests that look like a dynamic `import()`, which
// breaks MediaPipe's WASM loader when it runs inside the pipeline Worker. VitePWA's own
// precache/manifest generation reads the final `dist/` output on disk (via closeBundle), so it
// picks up rawStaticAssetsPlugin's emitted files the same as anything else in the bundle.
export default defineConfig({
  publicDir: false,
  plugins: [
    rawStaticAssetsPlugin(join(import.meta.dirname, "public")),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Halo Pulse",
        short_name: "Halo Pulse",
        description:
          "Personal wellness prototype: webcam-based facial tension/arousal tracking relative to your own baseline. Not a medical device.",
        theme_color: "#2a78d6",
        background_color: "#f9f9f7",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The MediaPipe WASM binaries and the face-landmarker model are tens of MB — see
        // ARCHITECTURE.md §10 "raise the 2MB cache cap." Precached once, all inference then works
        // fully offline (no CDN fetch — everything is already self-hosted, PLAN.md §7).
        globPatterns: ["**/*.{js,css,html,wasm,task,png,svg}"],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        // The DL-inference-latency spike (dlInferenceSpike.ts) is an "Experimental" Settings-
        // screen button, not part of the core offline promise the rest of this precache exists
        // for — its onnxruntime-web WASM runtime alone is ~40MB (its WebGPU/JSEP variant is
        // larger than the entire rest of the precache combined). Best-effort/online-only for that
        // one feature is the right tradeoff rather than doubling the app's install size.
        // Two patterns because the same file shows up twice: once under ort-spike/ (copied by
        // copy-dl-spike-assets.mjs for the explicit self-hosted wasmPaths onnxruntime-web is
        // configured with) and once under assets/ (Vite's own static analysis of the dynamically
        // imported onnxruntime-web chunk independently detects and copies its wasm reference).
        globIgnores: ["ort-spike/**", "**/*jsep*.wasm"],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    target: "es2022",
  },
});
