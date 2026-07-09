import { captureWorldSnapshot, restoreWorldSnapshot, type ContentBookmark } from "@engine/editor";
import {
  initializeDemoRuntime,
  fetchContentTree,
  loadWorldDefinition,
  materializeWorld,
  parseDemoWorldData,
  type ComponentDefinition,
  registerComponentDefinition,
  saveWorldDefinition,
  serializeWorld,
  setStorageNamespace,
  type PrefabDefinition,
  type DemoWorldData,
} from "@engine/runtime";
import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import { attachDebugEditor } from "./debug/editor";
import { bootstrapDemoSystems } from "./content/systems";

type ProjectManifest = {
  version: number;
  name: string;
  entryWorld: string;
  systems?: string[];
  bookmarks?: ContentBookmark[];
};

// The editor opens whatever project the CLI wired in; the manifest supplies the
// entry world and the default system set for worlds that don't declare their own.
// Returns null when no project is open (server active project cleared).
async function fetchProject(): Promise<ProjectManifest | null> {
  try {
    const res = await fetch("/api/project");
    if (res.ok) {
      const data = (await res.json()) as ProjectManifest | { open: false };
      if ("open" in data && data.open === false) return null;
      return data as ProjectManifest;
    }
  } catch {}
  return null;
}

let projectManifest: ProjectManifest = { version: 1, name: "Untitled", entryWorld: "worlds/main", systems: [] };

// Recent projects live client-side (the server has no per-user state).
const RECENTS_KEY = "engine.recentProjects";
function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (raw) return (JSON.parse(raw) as string[]).filter((p) => typeof p === "string");
  } catch {}
  return [];
}
function saveRecent(path: string) {
  const next = [path, ...loadRecents().filter((p) => p !== path)].slice(0, 10);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {}
}

// Switching projects reloads the page: the server swaps its active project and a
// fresh boot picks it up cleanly (avoids re-plumbing runtime module singletons).
async function switchProject(endpoint: "open" | "create", path: string) {
  const res = await fetch(`/api/project/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    window.alert(`${endpoint === "open" ? "Open" : "Create"} project failed: ${err.error ?? res.status}`);
    return;
  }
  saveRecent(path);
  location.reload();
}
async function closeCurrentProject() {
  await fetch("/api/project/close", { method: "POST" });
  location.reload();
}

// Ask the CLI (running on the user's machine) to open a native folder dialog and
// return the chosen absolute path.
async function browseProject(mode: "open" | "create"): Promise<string | null> {
  try {
    const res = await fetch(`/api/project/pick?mode=${mode}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { path?: string; cancelled?: boolean };
    return data.path ?? null;
  } catch {
    return null;
  }
}

const shell = document.createElement("main");
shell.className = "app-shell";
document.body.appendChild(shell);

const viewport = document.createElement("section");
viewport.className = "game-frame";
shell.appendChild(viewport);

let engine: Awaited<ReturnType<typeof createEngineApplication>> | undefined;
let debuggerEditor: ReturnType<typeof attachDebugEditor> | undefined;
let playbackState: "playing" | "paused" | "stopped" = "playing";
let contentDrawerOpen = false;
let openWorldPaths: string[] = [];

// One persistent world/physics/engine/debugger for the whole session — worlds load in place.
const gameWorld = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));
let worldName = "";
let activeWorldSystems: string[] = [];
let authoredSnapshot: ReturnType<typeof captureWorldSnapshot> | undefined;

// Reset the shared world/physics and re-materialize `name` into it (no teardown). Returns the fresh content tree.
async function materializeInto(name: string, override?: DemoWorldData) {
  worldName = name;
  const [worldData, contentTree] = await Promise.all([
    override ?? loadWorldDefinition(name),
    fetchContentTree(),
    initializeDemoRuntime(),
  ]);
  activeWorldSystems = resolveWorldSystems(worldData.systems);
  if (!openWorldPaths.includes(name)) openWorldPaths = [...openWorldPaths, name];
  if (override) saveWorldDefinition(name, override);

  gameWorld.reset();
  gameWorld.physics.clearBodies();
  await materializeWorld(gameWorld, worldData);
  gameWorld.clearSystems();
  await bootstrapDemoSystems(gameWorld, activeWorldSystems);
  return contentTree;
}

// Rebuild only the world's systems in place (correct order), keeping entities/engine.
async function reloadSystems(next: string[]) {
  activeWorldSystems = next;
  // In-memory only; the change is persisted on the next explicit save (⌘/Ctrl+S).
  gameWorld.clearSystems();
  await bootstrapDemoSystems(gameWorld, next);
  engine?.installSystems();
  debuggerEditor?.setActiveSystems(next);
  engine?.tick(0);
}

// Load a world in place (no engine/debugger/Pixi teardown → no flash).
async function loadWorld(name: string, override?: DemoWorldData) {
  const contentTree = await materializeInto(name, override);
  engine?.installSystems();
  authoredSnapshot = captureWorldSnapshot(gameWorld);
  debuggerEditor?.setActiveWorld(name, { activeSystems: activeWorldSystems, contentTree });
  playbackState = "stopped";
  engine?.stop();
  engine?.tick(0);
}

// Refresh only the content-drawer tree (for content create/import/delete).
// Does NOT reload the world — that would reset the editor selection/camera/playback.
async function refreshContent() {
  const contentTree = await fetchContentTree();
  debuggerEditor?.setContentTree(contentTree);
}

async function boot(startPlaying: boolean) {
  const project = await fetchProject();
  const hasProject = project !== null;
  if (project) {
    projectManifest = project;
    setStorageNamespace(project.name);
  }
  // No project open → boot an empty engine; the debugger's start screen (shown
  // when projectName is null) covers the UI with Open/Create/recent.
  const contentTree = hasProject ? await materializeInto(project.entryWorld) : [];

  engine = await createEngineApplication({
    world: gameWorld,
    mount: viewport,
    pixi: { width: 320, height: 180, background: 0x141414, roundPixels: true },
  });
  // createEngineApplication already installs its render systems; do not double-install here.
  authoredSnapshot = captureWorldSnapshot(gameWorld);

  debuggerEditor = attachDebugEditor(gameWorld, engine, {
    onPlay() {
      if (!engine) return;
      // Capture the pre-play authored state (incl. unsaved edits) so Stop restores it.
      if (playbackState === "stopped") authoredSnapshot = captureWorldSnapshot(gameWorld);
      playbackState = "playing";
      engine.start();
    },
    onPause() {
      if (!engine) return;
      playbackState = "paused";
      engine.stop();
    },
    onStep() {
      if (!engine) return;
      if (playbackState === "stopped") authoredSnapshot = captureWorldSnapshot(gameWorld);
      if (playbackState === "playing") engine.stop();
      playbackState = "paused";
      engine.tick(1 / 60);
    },
    onStop() {
      if (!engine) return;
      if (playbackState === "stopped") return; // nothing to revert; keep unsaved edits
      playbackState = "stopped";
      engine.stop();
      if (authoredSnapshot) restoreWorldSnapshot(gameWorld, authoredSnapshot);
      engine.tick(0);
    },
    getState() {
      return playbackState;
    },
    onSaveWorld(editedWorld) {
      // Explicit save (⌘/Ctrl+S) — the only place in-editor world changes hit disk.
      void saveWorldDefinition(worldName, serializeWorld(editedWorld, activeWorldSystems));
    },
    onOpenLevel(data) {
      const level = parseDemoWorldData(data);
      if (!level) return;
      void loadWorld(worldName, level);
    },
    onLoadWorld(name) {
      if (name === worldName) return;
      void loadWorld(name);
    },
    async onCreateWorld(name) {
      await saveWorldDefinition(name, { version: 1, systems: [], entities: [] });
      await refreshContent();
    },
    onAddSystem(name) {
      void reloadSystems(Array.from(new Set([...activeWorldSystems, name])));
    },
    onRemoveSystem(name) {
      void reloadSystems(activeWorldSystems.filter((system) => system !== name));
    },
    async onCreateFolder(path) {
      await fetch(`/api/content/folder?path=${encodeURIComponent(path)}`, { method: "POST" });
      await refreshContent();
    },
    async onCreateComponent(path) {
      const componentName = path.split("/").filter(Boolean).at(-1) ?? "component";
      const definition: ComponentDefinition = {
        version: 1,
        id: componentName,
        label: toTitleCase(componentName),
        defaultValue: {},
      };
      await saveContentJson(path, definition);
      registerComponentDefinition(definition);
      await refreshContent();
    },
    async onCreatePrefab(path) {
      const prefabName = path.split("/").filter(Boolean).at(-1) ?? "prefab";
      const definition: PrefabDefinition = {
        version: 1,
        name: prefabName,
        components: [{ component: "transform", value: { x: 0, y: 0, rotation: 0, scale: 1 } }],
      };
      await saveContentJson(path, definition);
      await refreshContent();
    },
    async onCreateGraph(path) {
      const graphName = path.split("/").filter(Boolean).at(-1) ?? "system";
      await saveContentJson(path, {
        version: 3,
        name: graphName,
        entrypoint: crypto.randomUUID(),
        variables: [],
        nodes: [{ id: crypto.randomUUID(), type: "OnUpdate", position: { x: 80, y: 80 } }],
        edges: [],
      });
      await refreshContent();
    },
    async onImportContent(path, value) {
      await saveContentJson(path, value);
      await refreshContent();
    },
    async onDeleteContent(path, kind) {
      const endpoint = kind === "folder" ? "/api/content/folder" : "/api/content/file";
      await fetch(`${endpoint}?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      await refreshContent();
    },
    async onRename(from, to, kind) {
      await fetch("/api/content/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, kind }),
      });
      // Keep the host's open-world/active-world identity in sync with the new
      // path (covers folder renames that reparent open worlds too), then let the
      // editor relabel its tabs.
      openWorldPaths = openWorldPaths.map((path) => remapContentPath(path, from, to));
      worldName = remapContentPath(worldName, from, to);
      // Keep project.json's entry world pointing at the renamed world (or a world
      // moved by a renamed parent folder), so the next boot opens the right one.
      const nextEntry = remapContentPath(projectManifest.entryWorld, from, to);
      if (nextEntry !== projectManifest.entryWorld) {
        projectManifest = { ...projectManifest, entryWorld: nextEntry };
        void fetch("/api/project/entry-world", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryWorld: nextEntry }),
        });
      }
      // Rewrite the renamed path (and anything under a renamed folder) inside any
      // bookmark that references it, then persist + push the update to the editor.
      const currentBookmarks = projectManifest.bookmarks ?? [];
      const affectsBookmarks = currentBookmarks.some((bookmark) =>
        bookmark.items.some((item) => item === from || item.startsWith(`${from}/`)),
      );
      if (affectsBookmarks) {
        const nextBookmarks = currentBookmarks.map((bookmark) => ({
          ...bookmark,
          items: bookmark.items.map((item) => remapContentPath(item, from, to)),
        }));
        projectManifest = { ...projectManifest, bookmarks: nextBookmarks };
        void fetch("/api/project/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarks: nextBookmarks }),
        });
        debuggerEditor?.setBookmarks(nextBookmarks);
      }
      debuggerEditor?.renameContent(from, to);
      await refreshContent();
    },
    bookmarks: projectManifest.bookmarks ?? [],
    onBookmarksChange(bookmarks) {
      projectManifest = { ...projectManifest, bookmarks };
      void fetch("/api/project/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarks }),
      });
    },
    initialContentDrawerOpen: contentDrawerOpen,
    onContentDrawerToggled(open) {
      contentDrawerOpen = open;
    },
    initialOpenWorlds: openWorldPaths,
    onOpenWorldsChanged(paths) {
      openWorldPaths = paths;
    },
    onOpenProject: (path) => { void switchProject("open", path); },
    onCreateProject: (path) => { void switchProject("create", path); },
    onCloseProject: () => { void closeCurrentProject(); },
    onBrowseProject: browseProject,
    projectName: hasProject ? projectManifest.name : null,
    recentProjects: loadRecents(),
    contentTree,
    activeWorld: worldName,
    activeSystems: activeWorldSystems,
  });

  if (startPlaying) {
    playbackState = "playing";
    engine.start();
  } else {
    playbackState = "stopped";
    engine.stop();
    engine.tick(0);
  }
}

// Editor opens in a stopped state; the game runs only when the user presses Play.
await boot(false);

async function saveContentJson(path: string, data: unknown) {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  });
}

// Remap a content path after `from` was renamed to `to`, including paths nested
// under a renamed folder. Returns the path unchanged when unaffected.
function remapContentPath(path: string, from: string, to: string) {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}/${path.slice(from.length + 1)}`;
  return path;
}

function toTitleCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveWorldSystems(systems: string[]) {
  // A world declares its own systems; fall back to the project defaults when it
  // has none (e.g. a freshly created world).
  return systems.length > 0 ? systems : projectManifest.systems ?? [];
}
