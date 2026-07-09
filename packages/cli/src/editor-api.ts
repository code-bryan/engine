import { execFile } from "node:child_process";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { promisify } from "node:util";
import { createContentApiMiddleware } from "./content-api";

const execFileAsync = promisify(execFile);
import { initProject } from "./init";
import { loadProject, saveProjectBookmarks, saveProjectEntryWorld, type ProjectBookmark, type ResolvedProject } from "./project";

type Next = (err?: unknown) => void;

// Owns the editor's mutable active project and serves both the project-management
// routes (/api/project*) and the content routes (via content-api, scoped to the
// active project's content dir). The active project can change at runtime through
// open/create/close, so the whole editor server is one factory.
export function createEditorApi(initialDir?: string) {
  let active: ResolvedProject | null = null;

  // Load the initial project (from `engine edit <dir>`) eagerly-ish: kick it off
  // now; requests before it resolves simply see "no project" until it lands.
  const ready = initialDir
    ? loadProject(initialDir).then((project) => { active = project; }).catch((error) => {
        console.error(`engine: failed to open ${initialDir}: ${error instanceof Error ? error.message : error}`);
      })
    : Promise.resolve();

  const contentApi = createContentApiMiddleware(() => active?.contentDir ?? null);

  function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
  }

  async function switchTo(res: ServerResponse, load: () => Promise<ResolvedProject>) {
    try {
      active = await load();
      sendJson(res, 200, active.manifest);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "invalid project" });
    }
  }

  function middleware(req: IncomingMessage, res: ServerResponse, next: Next) {
    const url = new URL(req.url ?? "", "http://localhost");
    const pathName = url.pathname;

    if (req.method === "GET" && pathName === "/api/project") {
      ready.then(() => sendJson(res, 200, active ? active.manifest : { open: false }));
      return;
    }

    // Native OS folder picker — the CLI runs on the user's machine, so it can pop
    // a real dialog and return the chosen absolute path (a browser can't).
    if (req.method === "GET" && pathName === "/api/project/pick") {
      const create = url.searchParams.get("mode") === "create";
      pickFolder(create)
        .then((picked) => sendJson(res, 200, picked ? { path: picked } : { cancelled: true }))
        .catch((error) => sendJson(res, 500, { error: error instanceof Error ? error.message : "picker failed" }));
      return;
    }

    if (req.method === "POST" && pathName === "/api/project/open") {
      readBody(req).then((body) => {
        const path = parsePath(body);
        if (!path) return sendJson(res, 400, { error: "missing path" });
        return switchTo(res, () => loadProject(path));
      });
      return;
    }

    if (req.method === "POST" && pathName === "/api/project/create") {
      readBody(req).then((body) => {
        const path = parsePath(body);
        if (!path) return sendJson(res, 400, { error: "missing path" });
        return switchTo(res, async () => {
          await initProject(path);
          return loadProject(path);
        });
      });
      return;
    }

    if (req.method === "POST" && pathName === "/api/project/close") {
      active = null;
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && pathName === "/api/project/bookmarks") {
      if (!active) return sendJson(res, 409, { error: "no project open" });
      const project = active;
      readBody(req).then(async (body) => {
        try {
          const parsed = JSON.parse(body) as { bookmarks?: unknown };
          const bookmarks = normalizeBookmarks(parsed.bookmarks);
          await saveProjectBookmarks(project.root, bookmarks);
          project.manifest.bookmarks = bookmarks;
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : "invalid bookmarks" });
        }
      });
      return;
    }

    if (req.method === "POST" && pathName === "/api/project/entry-world") {
      if (!active) return sendJson(res, 409, { error: "no project open" });
      const project = active;
      readBody(req).then(async (body) => {
        try {
          const parsed = JSON.parse(body) as { entryWorld?: unknown };
          if (typeof parsed.entryWorld !== "string" || !parsed.entryWorld) {
            return sendJson(res, 400, { error: "missing entryWorld" });
          }
          await saveProjectEntryWorld(project.root, parsed.entryWorld);
          project.manifest.entryWorld = parsed.entryWorld;
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : "invalid entryWorld" });
        }
      });
      return;
    }

    // Everything else is content — scoped to the active project (or empty).
    contentApi(req, res, next);
  }

  return {
    middleware,
    getAssetsDir: () => active?.assetsDir ?? null,
  };
}

// Open a native folder-selection dialog and return the chosen absolute path, or
// null if cancelled. Platform-specific; unsupported platforms reject.
async function pickFolder(create: boolean): Promise<string | null> {
  const prompt = create ? "Choose a location for the new project" : "Select a project folder";
  let cmd: string[];
  if (process.platform === "darwin") {
    cmd = ["osascript", "-e", `POSIX path of (choose folder with prompt "${prompt}")`];
  } else if (process.platform === "linux") {
    cmd = ["zenity", "--file-selection", "--directory", `--title=${prompt}`];
  } else if (process.platform === "win32") {
    cmd = ["powershell", "-NoProfile", "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }"];
  } else {
    throw new Error(`native folder picker not supported on ${process.platform}`);
  }

  // Uses node:child_process (not Bun.spawn) — the Vite dev server runs under Node.
  try {
    const { stdout } = await execFileAsync(cmd[0], cmd.slice(1));
    const picked = stdout.trim();
    return picked ? picked.replace(/\/$/, "") : null;
  } catch {
    // Non-zero exit (e.g. the user cancelled the dialog) surfaces as a rejection.
    return null;
  }
}

function normalizeBookmarks(raw: unknown): ProjectBookmark[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as Partial<ProjectBookmark>;
    if (typeof value.id !== "string" || typeof value.name !== "string") return [];
    const items = Array.isArray(value.items) ? value.items.filter((item): item is string => typeof item === "string") : [];
    return [{ id: value.id, name: value.name, items }];
  });
}

function parsePath(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { path?: unknown };
    return typeof parsed.path === "string" && parsed.path.trim() ? parsed.path.trim() : null;
  } catch {
    return null;
  }
}
