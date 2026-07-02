import { join } from "node:path";
import { defineConfig } from "vite";
import { rawStaticAssetsPlugin } from "./viteRawStaticAssets.js";

// PWA packaging (service worker, offline model caching — ARCHITECTURE.md §10) is documented as
// a Phase 4 concern and is not wired up yet; this is a plain Vite dev/build config.
//
// publicDir is disabled in favor of rawStaticAssetsPlugin — see that file's docstring for why:
// Vite's built-in publicDir serving refuses requests that look like a dynamic `import()`, which
// breaks MediaPipe's WASM loader when it runs inside the pipeline Worker.
export default defineConfig({
  publicDir: false,
  plugins: [rawStaticAssetsPlugin(join(import.meta.dirname, "public"))],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    target: "es2022",
  },
});
