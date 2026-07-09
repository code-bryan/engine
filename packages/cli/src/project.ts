import { access, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

// A project is any folder on disk with a `project.json` manifest, a `content/`
// tree, and an `assets/` folder. The editor opens one at a time.

export type ProjectBookmark = {
  id: string;
  name: string;
  items: string[];
};

export type ProjectManifest = {
  version: 1;
  name: string;
  entryWorld: string;
  systems?: string[];
  bookmarks?: ProjectBookmark[];
};

export type ResolvedProject = {
  root: string;
  contentDir: string;
  assetsDir: string;
  manifest: ProjectManifest;
};

export function resolveProjectRoot(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

export async function loadProject(dir: string): Promise<ResolvedProject> {
  const root = resolveProjectRoot(dir);
  const manifestPath = join(root, "project.json");
  try {
    await access(manifestPath);
  } catch {
    throw new Error(`no project.json found in ${root} — run \`engine init ${dir}\` to scaffold one`);
  }

  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf-8")), root);
  return {
    root,
    contentDir: join(root, "content"),
    assetsDir: join(root, "assets"),
    manifest,
  };
}

function parseManifest(raw: unknown, root: string): ProjectManifest {
  if (!raw || typeof raw !== "object") throw new Error(`invalid project.json in ${root}`);
  const value = raw as Partial<ProjectManifest>;
  if (value.version !== 1) throw new Error(`unsupported project.json version in ${root} (expected 1)`);
  if (typeof value.name !== "string" || !value.name) throw new Error(`project.json missing "name" in ${root}`);
  if (typeof value.entryWorld !== "string" || !value.entryWorld) {
    throw new Error(`project.json missing "entryWorld" in ${root}`);
  }
  return {
    version: 1,
    name: value.name,
    entryWorld: value.entryWorld,
    systems: Array.isArray(value.systems) ? value.systems.filter((s): s is string => typeof s === "string") : [],
    bookmarks: parseBookmarks(value.bookmarks),
  };
}

function parseBookmarks(raw: unknown): ProjectBookmark[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as Partial<ProjectBookmark>;
    if (typeof value.id !== "string" || typeof value.name !== "string") return [];
    const items = Array.isArray(value.items) ? value.items.filter((item): item is string => typeof item === "string") : [];
    return [{ id: value.id, name: value.name, items }];
  });
}

// Shallow-merge a patch into an existing project.json, preserving every other
// field (and formatting as pretty JSON, matching how the editor writes content).
async function patchManifest(root: string, patch: Record<string, unknown>): Promise<void> {
  const manifestPath = join(root, "project.json");
  const raw = JSON.parse(await readFile(manifestPath, "utf-8")) as Record<string, unknown>;
  await writeFile(manifestPath, `${JSON.stringify({ ...raw, ...patch }, null, 2)}\n`, "utf-8");
}

export async function saveProjectBookmarks(root: string, bookmarks: ProjectBookmark[]): Promise<void> {
  await patchManifest(root, { bookmarks });
}

export async function saveProjectEntryWorld(root: string, entryWorld: string): Promise<void> {
  await patchManifest(root, { entryWorld });
}
