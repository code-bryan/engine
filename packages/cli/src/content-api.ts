import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, relative, resolve } from "node:path";

// Folder-scoped content filesystem API. All handlers operate on `contentDir`
// (a project's `content/` folder) — nothing is hardcoded, so the same code
// serves any project the editor opens. Extracted verbatim from the old Vite
// `worldEditorPlugin` so behaviour (and the path-traversal guards) is unchanged.

export type ContentTreeNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "prefab" | "component" | "graph" | "file";
  children?: ContentTreeNode[];
};

type Next = (err?: unknown) => void;

// Connect-style middleware factory. Returns a handler that answers the
// `/api/*` content routes and calls `next()` for everything else. `getContentDir`
// is read per request so the active project can change at runtime; when it
// returns null (no project open) the routes respond empty/404 instead of reading disk.
export function createContentApiMiddleware(getContentDir: () => string | null) {
  return function contentApi(req: IncomingMessage, res: ServerResponse, next: Next) {
    const url = new URL(req.url ?? "", "http://localhost");
    const pathName = url.pathname;
    const contentPath = url.searchParams.get("path") ?? "";

    const contentDir = getContentDir();
    if (!contentDir) {
      if (pathName === "/api/content/tree") {
        res.setHeader("Content-Type", "application/json");
        res.end("[]");
        return;
      }
      if (pathName === "/api/worlds") {
        res.setHeader("Content-Type", "application/json");
        res.end("[]");
        return;
      }
      if (pathName === "/api/content/file" || pathName === "/api/world" || pathName === "/api/content/folder") {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: "no project open" }));
        return;
      }
      next();
      return;
    }

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

    if (req.method === "DELETE" && pathName === "/api/content/folder") {
      deleteContentPath(contentDir, contentPath, true)
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

    if (req.method === "POST" && pathName === "/api/content/rename") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        let body: { from?: unknown; to?: unknown; kind?: unknown };
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid JSON" }));
          return;
        }
        const from = typeof body.from === "string" ? body.from : "";
        const to = typeof body.to === "string" ? body.to : "";
        renameContentPath(contentDir, from, to, body.kind === "folder")
          .then(() => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          })
          .catch((error) => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid path" }));
          });
      });
      return;
    }

    if (pathName === "/api/content/file" || pathName === "/api/world") {
      serveJsonFile(contentDir, contentPath, req, res);
      return;
    }

    next();
  };
}

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
      const folderKind = path.startsWith("worlds/")
        ? "world"
        : path.startsWith("prefabs/")
          ? "prefab"
          : path.startsWith("components/")
            ? "component"
            : path.startsWith("systems/")
              ? "graph"
              : "file";
      // A graph/system asset can live in any folder — detect it by shape so it isn't
      // misclassified as a plain "file" outside systems/.
      let kind: ContentTreeNode["kind"] = folderKind;
      if (kind === "file") {
        try {
          const parsed = JSON.parse(await readFile(abs, "utf8"));
          if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && typeof parsed.entrypoint === "string") {
            kind = "graph";
          }
        } catch {
          // not JSON we can read; leave as "file"
        }
      }
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

  if (req.method === "DELETE") {
    deleteContentPath(root, relPath, false)
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
}

async function renameContentPath(root: string, from: string, to: string, isFolder: boolean) {
  const src = isFolder ? resolveContentPath(root, normalizeContentPath(from)) : resolveJsonFilePath(root, from);
  const dst = isFolder ? resolveContentPath(root, normalizeContentPath(to)) : resolveJsonFilePath(root, to);
  await mkdir(dirname(dst), { recursive: true });
  await rename(src, dst);
}

async function deleteContentPath(root: string, relPath: string, isFolder: boolean) {
  if (isFolder) {
    const target = resolveContentPath(root, normalizeContentPath(relPath));
    await rm(target, { recursive: true, force: false });
    return;
  }
  const filePath = resolveJsonFilePath(root, relPath);
  await rm(filePath, { force: false });
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
