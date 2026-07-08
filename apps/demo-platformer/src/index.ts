import { captureWorldSnapshot, restoreWorldSnapshot } from "@engine/debugger";
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
  type PrefabDefinition,
  type DemoWorldData,
} from "@engine/runtime";
import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import { attachDebugEditor } from "./debug/editor";
import { bootstrapDemoSystems } from "./content/systems";

const defaultWorldSystems = [
  "player-control",
  "enemy-follow",
  "actor-state",
  "sprite-facing",
  "restart-on-enemy-touch",
];

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
let worldName = "worlds/world-01";
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
  saveWorldDefinition(worldName, serializeWorld(gameWorld, next));
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
  const contentTree = await materializeInto("worlds/world-01");

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
      if (playbackState === "playing") engine.stop();
      playbackState = "paused";
      engine.tick(1 / 60);
    },
    onStop() {
      if (!engine) return;
      playbackState = "stopped";
      engine.stop();
      if (authoredSnapshot) restoreWorldSnapshot(gameWorld, authoredSnapshot);
      engine.tick(0);
    },
    getState() {
      return playbackState;
    },
    onWorldEdited(editedWorld) {
      saveWorldDefinition(worldName, serializeWorld(editedWorld, activeWorldSystems));
      authoredSnapshot = captureWorldSnapshot(editedWorld);
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
    initialContentDrawerOpen: contentDrawerOpen,
    onContentDrawerToggled(open) {
      contentDrawerOpen = open;
    },
    initialOpenWorlds: openWorldPaths,
    onOpenWorldsChanged(paths) {
      openWorldPaths = paths;
    },
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

await boot(true);

async function saveContentJson(path: string, data: unknown) {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  });
}

function toTitleCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveWorldSystems(systems: string[]) {
  return systems;
}
