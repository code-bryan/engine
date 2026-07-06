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

async function mountGame(startPlaying: boolean, worldName = "worlds/world-01", worldOverride?: DemoWorldData) {
  debuggerEditor?.destroy();
  engine?.destroy();
  viewport.replaceChildren();

  const gameWorld = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));
  const [worldData, contentTree] = await Promise.all([
    worldOverride ?? loadWorldDefinition(worldName),
    fetchContentTree(),
    initializeDemoRuntime(),
  ]);
  const activeWorldSystems = resolveWorldSystems(worldData.systems);
  if (worldOverride) saveWorldDefinition(worldName, worldOverride);
  await materializeWorld(gameWorld, worldData);
  await bootstrapDemoSystems(gameWorld, activeWorldSystems);
  let authoredSnapshot = captureWorldSnapshot(gameWorld);

  engine = await createEngineApplication({
    world: gameWorld,
    mount: viewport,
    pixi: { width: 320, height: 180, background: 0x2c2c38, roundPixels: true },
  });

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
      restoreWorldSnapshot(gameWorld, authoredSnapshot);
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
      mountGame(false, worldName, level);
    },
    onLoadWorld(name) {
      if (name === worldName) return;
      mountGame(false, name);
    },
    async onCreateWorld(name) {
      await saveWorldDefinition(name, {
        version: 1,
        systems: defaultWorldSystems,
        entities: [],
      });
      await mountGame(false, name);
    },
    async onCreateFolder(path) {
      await fetch(`/api/content/folder?path=${encodeURIComponent(path)}`, { method: "POST" });
      await mountGame(false, worldName);
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
      await mountGame(false, worldName);
    },
    initialContentDrawerOpen: contentDrawerOpen,
    onContentDrawerToggled(open) {
      contentDrawerOpen = open;
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

await mountGame(true);

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
  return systems.length > 0 ? systems : defaultWorldSystems;
}
