import { defineConfig } from "vite";

// PWA packaging (service worker, offline model caching — ARCHITECTURE.md §10) is documented as
// a Phase 4 concern and is not wired up yet; this is a plain Vite dev/build config for the
// Phase 0 spike.
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    target: "es2022",
  },
});
