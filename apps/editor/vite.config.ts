import { createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { createEditorApi } from "../../packages/cli/src/editor-api";

// The editor opens whatever project the `engine` CLI points it at via
// ENGINE_PROJECT. When run bare (plain `vite`), it falls back to the bundled
// example project so the app still boots for development. The active project can
// then be changed at runtime via the /api/project routes (createEditorApi).
const initialProject = process.env.ENGINE_PROJECT
  ? resolve(process.env.ENGINE_PROJECT)
  : resolve(__dirname, "../../examples/platformer");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function projectPlugin(): Plugin {
  const api = createEditorApi(initialProject);

  return {
    name: "engine-project",
    apply: "serve",
    configureServer(server) {
      // Don't let content writes trigger a full Vite reload.
      server.watcher.unwatch(join(initialProject, "content"));
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost");

        // Project assets (sprites, etc.) — served from the active project's assets/ dir.
        if (url.pathname.startsWith("/assets/")) {
          const assetsDir = api.getAssetsDir();
          if (!assetsDir) {
            res.statusCode = 404;
            res.end("no project");
            return;
          }
          const rel = decodeURIComponent(url.pathname.slice("/assets/".length));
          const filePath = resolve(assetsDir, rel);
          if (!filePath.startsWith(resolve(assetsDir))) {
            res.statusCode = 400;
            res.end("invalid path");
            return;
          }
          res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream");
          const stream = createReadStream(filePath);
          stream.on("error", () => {
            res.statusCode = 404;
            res.end("not found");
          });
          stream.pipe(res);
          return;
        }

        api.middleware(req, res, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [projectPlugin()],
  resolve: {
    alias: {
      "@engine/ecs-core": resolve(__dirname, "../../packages/ecs-core/src/index.ts"),
      "@engine/components": resolve(__dirname, "../../packages/components/src/index.ts"),
      "@engine/editor": resolve(__dirname, "../../packages/editor/src/index.ts"),
      "@engine/renderer": resolve(__dirname, "../../packages/renderer/src/index.ts"),
      "@engine/loader": resolve(__dirname, "../../packages/loader/src/index.ts"),
      "@engine/input": resolve(__dirname, "../../packages/input/src/index.ts"),
      "@engine/physics": resolve(__dirname, "../../packages/physics/src/index.ts"),
      "@engine/runtime": resolve(__dirname, "../../packages/runtime/src/index.ts"),
    },
  },
});
