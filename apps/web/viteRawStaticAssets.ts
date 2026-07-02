import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { Plugin } from "vite";

const MIME_TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".md": "text/markdown",
  ".json": "application/json",
};

function walk(dir: string, urlPrefix: string, out: Map<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const urlPath = `${urlPrefix}/${entry}`;
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath, urlPath, out);
    } else {
      out.set(urlPath, fullPath);
    }
  }
}

/**
 * MediaPipe's tasks-vision bundle dynamically `import()`s its WASM glue code when running
 * inside a module Worker — a different loading path than it uses on the main thread — but
 * Vite's dev server explicitly refuses to serve files under `publicDir` through an
 * `import()`-triggered request: "This file is in /public ... should not be imported from
 * source code." (This is why the Phase 0 main-thread version worked but the Worker version
 * didn't.) We can't change MediaPipe's internal loader, so instead we disable Vite's built-in
 * `publicDir` handling (see vite.config.ts) and serve `publicDir` ourselves, as genuinely raw
 * static files with no import-analysis interception — replicating what `publicDir` does
 * automatically, minus the guard that breaks this specific case. See ARCHITECTURE.md §3/§10 for
 * why these assets are self-hosted at all rather than loaded from a CDN.
 */
export function rawStaticAssetsPlugin(publicDir: string): Plugin {
  return {
    name: "halo-pulse-raw-static-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const urlPath = req.url.split("?")[0]!;
        const filePath = join(publicDir, decodeURIComponent(urlPath));
        if (
          !filePath.startsWith(publicDir) ||
          !existsSync(filePath) ||
          statSync(filePath).isDirectory()
        ) {
          return next();
        }
        res.setHeader("Content-Type", MIME_TYPES[extname(filePath)] ?? "application/octet-stream");
        res.end(readFileSync(filePath));
      });
    },
    generateBundle() {
      if (!existsSync(publicDir)) return;
      const files = new Map<string, string>();
      walk(publicDir, "", files);
      for (const [urlPath, fullPath] of files) {
        this.emitFile({
          type: "asset",
          fileName: urlPath.replace(/^\//, ""),
          source: readFileSync(fullPath),
        });
      }
    },
  };
}
