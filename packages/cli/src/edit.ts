import { resolve } from "node:path";
import { loadProject } from "./project";

// Launch the editor pointed at a project folder. For this milestone we spawn the
// existing Vite dev server for apps/editor with ENGINE_PROJECT set; the editor's
// Vite config uses that env var to scope its content API and serve project assets.
// (A prebuilt standalone Bun.serve is the natural next iteration.)
export async function editProject(dir: string): Promise<void> {
  const project = await loadProject(dir);
  const editorDir = resolve(import.meta.dir, "../../../apps/editor");

  console.log(`engine: opening "${project.manifest.name}" (${project.root})`);

  const proc = Bun.spawn(["bun", "run", "dev"], {
    cwd: editorDir,
    env: { ...process.env, ENGINE_PROJECT: project.root },
    stdio: ["inherit", "inherit", "inherit"],
  });

  const code = await proc.exited;
  if (code !== 0) process.exit(code);
}
