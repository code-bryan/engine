import { access, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

// A project is any folder on disk with a `project.json` manifest, a `content/`
// tree, and an `assets/` folder. The editor opens one at a time.

export type ProjectManifest = {
  version: 1;
  name: string;
  entryWorld: string;
  systems?: string[];
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
  };
}
