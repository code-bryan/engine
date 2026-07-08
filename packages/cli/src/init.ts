import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { resolveProjectRoot, type ProjectManifest } from "./project";

// Scaffold a new project folder: manifest + empty content tree + assets dir,
// seeded with one empty world so the editor opens on something valid.
export async function initProject(dir: string): Promise<string> {
  const root = resolveProjectRoot(dir);
  const name = basename(root);

  await Promise.all([
    mkdir(join(root, "content", "worlds"), { recursive: true }),
    mkdir(join(root, "content", "prefabs"), { recursive: true }),
    mkdir(join(root, "content", "components"), { recursive: true }),
    mkdir(join(root, "content", "systems"), { recursive: true }),
    mkdir(join(root, "assets"), { recursive: true }),
  ]);

  const manifest: ProjectManifest = {
    version: 1,
    name,
    entryWorld: "worlds/main",
    systems: [],
  };
  await writeFile(join(root, "project.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  await writeFile(
    join(root, "content", "worlds", "main.json"),
    `${JSON.stringify({ version: 1, systems: [], entities: [] }, null, 2)}\n`,
    "utf-8",
  );

  return root;
}
