import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function worldEditorPlugin(): Plugin {
  const worldsDir = resolve(__dirname, "src/worlds");

  return {
    name: "world-editor",
    apply: "serve",
    configureServer(server) {
      server.watcher.unwatch(worldsDir);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";

        if (req.method === "GET" && url === "/api/worlds") {
          readdir(worldsDir)
            .then((files) => {
              const names = files
                .filter((f) => f.endsWith(".json"))
                .map((f) => ({ name: f.replace(/\.json$/, "") }));
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(names));
            })
            .catch(() => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "read failed" }));
            });
          return;
        }

        const match = url.match(/^\/api\/world\/([a-z0-9-]+)$/);
        if (!match) return next();

        const filePath = join(worldsDir, `${match[1]}.json`);

        if (req.method === "GET") {
          readFile(filePath, "utf-8")
            .then((data) => {
              res.setHeader("Content-Type", "application/json");
              res.end(data);
            })
            .catch(() => {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "not found" }));
            });
          return;
        }

        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf-8");
            try {
              JSON.parse(body);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid JSON" }));
              return;
            }
            writeFile(filePath, body, "utf-8")
              .then(() => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
              })
              .catch(() => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "write failed" }));
              });
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [worldEditorPlugin()],
  resolve: {
    alias: {
      "@engine/ecs-core": resolve(__dirname, "../../packages/ecs-core/src/index.ts"),
      "@engine/debugger": resolve(__dirname, "../../packages/debugger/src/index.ts"),
      "@engine/renderer": resolve(__dirname, "../../packages/renderer/src/index.ts"),
      "@engine/loader": resolve(__dirname, "../../packages/loader/src/index.ts"),
      "@engine/input": resolve(__dirname, "../../packages/input/src/index.ts"),
      "@engine/physics": resolve(__dirname, "../../packages/physics/src/index.ts"),
    },
  },
});
