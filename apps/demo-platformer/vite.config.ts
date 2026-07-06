import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, relative, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

type ContentTreeNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "prefab" | "component" | "graph";
  children?: ContentTreeNode[];
};

function worldEditorPlugin(): Plugin {
  const contentDir = resolve(__dirname, "src/content");

  return {
    name: "world-editor",
    apply: "serve",
    configureServer(server) {
      server.watcher.unwatch(contentDir);
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const pathName = url.pathname;
        const contentPath = url.searchParams.get("path") ?? "";

        if (req.method === "GET" && pathName === "/api/worlds") {
          collectWorldNames(contentDir)
            .then((names) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(names.map((name) => ({ name }))));
            })
            .catch(() => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "read failed" }));
            });
          return;
        }

        if (req.method === "GET" && pathName === "/api/content/tree") {
          readContentTree(contentDir)
            .then((tree) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(tree));
            })
            .catch(() => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "read failed" }));
            });
          return;
        }

        if (req.method === "POST" && pathName === "/api/content/folder") {
          createSafePath(contentDir, contentPath)
            .then((absolutePath) => mkdir(absolutePath, { recursive: true }))
            .then(() => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            })
            .catch((error) => {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid path" }));
            });
          return;
        }

        if (pathName === "/api/content/file" || pathName === "/api/world") {
          serveJsonFile(contentDir, contentPath, req, res);
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

async function collectWorldNames(root: string, base = ""): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const names = await Promise.all(entries.map(async (entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = join(root, entry.name);
    if (entry.isDirectory()) return collectWorldNames(abs, rel);
    if (entry.isFile() && entry.name.endsWith(".json")) return [rel.replace(/\.json$/, "")];
    return [];
  }));
  return names.flat().sort();
}

async function readContentTree(root: string, base = ""): Promise<ContentTreeNode[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const sorted = entries.sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  const nodes = await Promise.all(sorted.map(async (entry): Promise<ContentTreeNode | null> => {
    const path = base ? `${base}/${entry.name}` : entry.name;
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path,
        kind: "folder",
        children: await readContentTree(abs, path),
      } satisfies ContentTreeNode;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const kind = path.startsWith("worlds/")
        ? "world"
        : path.startsWith("prefabs/")
          ? "prefab"
          : path.startsWith("components/")
            ? "component"
            : path.startsWith("systems/")
              ? "graph"
              : null;
      if (!kind) return null;
      return {
        name: entry.name.replace(/\.json$/, ""),
        path: path.replace(/\.json$/, ""),
        kind,
      } satisfies ContentTreeNode;
    }
    return null;
  }));

  return nodes.filter((node) => node !== null);
}

async function createSafePath(root: string, relPath: string) {
  return resolveContentPath(root, normalizeContentPath(relPath));
}

function serveJsonFile(root: string, relPath: string, req: IncomingMessage, res: ServerResponse) {
  let filePath: string;
  try {
    filePath = resolveJsonFilePath(root, relPath);
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid path" }));
    return;
  }

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
      mkdir(dirname(filePath), { recursive: true })
        .then(() => writeFile(filePath, body, "utf-8"))
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
}

function normalizeContentPath(relPath: string) {
  const normalized = relPath.replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
  if (!normalized) throw new Error("missing path");
  if (normalized.split("/").some((segment) => segment === ".." || segment === "")) throw new Error("invalid path");
  return normalized;
}

function resolveContentPath(root: string, relPath: string) {
  const absolute = resolve(root, relPath);
  const rel = relative(root, absolute);
  if (rel.startsWith("..") || rel === ".." || rel.includes("../")) {
    throw new Error("invalid path");
  }
  return absolute;
}

function resolveJsonFilePath(root: string, relPath: string) {
  const normalized = normalizeContentPath(relPath);
  const withExt = normalized.endsWith(".json") ? normalized : `${normalized}.json`;
  return resolveContentPath(root, withExt);
}
