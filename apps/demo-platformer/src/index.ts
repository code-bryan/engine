import { captureWorldSnapshot, restoreWorldSnapshot } from "@engine/debugger";
import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import { attachDebugEditor } from "./debug/editor";
import {
  loadWorldDefinition,
  materializeWorld,
  parseDemoWorldData,
  saveWorldDefinition,
  serializeWorld,
  type DemoWorldData,
} from "./worlds";
import { bootstrapDemoSystems } from "./systems";

const shell = document.createElement("main");
shell.className = "app-shell";
document.body.appendChild(shell);

const viewport = document.createElement("section");
viewport.className = "game-frame";
shell.appendChild(viewport);

let engine: Awaited<ReturnType<typeof createEngineApplication>> | undefined;
let debuggerEditor: ReturnType<typeof attachDebugEditor> | undefined;
let playbackState: "playing" | "paused" | "stopped" = "playing";
let worldsDrawerOpen = false;

async function fetchWorldsList(): Promise<{ name: string }[]> {
  try {
    const res = await fetch("/api/worlds");
    if (res.ok) return await res.json() as { name: string }[];
  } catch {}
  return [{ name: "world-01" }];
}

async function mountGame(startPlaying: boolean, worldName = "world-01", worldOverride?: DemoWorldData) {
  debuggerEditor?.destroy();
  engine?.destroy();
  viewport.replaceChildren();

  const gameWorld = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));
  const [worldData, worlds] = await Promise.all([
    worldOverride ?? loadWorldDefinition(worldName),
    fetchWorldsList(),
  ]);
  if (worldOverride) saveWorldDefinition(worldName, worldOverride);
  await materializeWorld(gameWorld, worldData);
  bootstrapDemoSystems(gameWorld);
  let authoredSnapshot = captureWorldSnapshot(gameWorld);

  engine = await createEngineApplication({
    world: gameWorld,
    mount: viewport,
    pixi: { width: 320, height: 180, background: 0x2c2c38 },
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
      saveWorldDefinition(worldName, serializeWorld(editedWorld));
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
    onCreateWorld(name) {
      saveWorldDefinition(name, { version: 1, entities: [] }).catch(() => {});
      mountGame(false, name);
    },
    initialWorldsOpen: worldsDrawerOpen,
    onWorldsToggled(open) {
      worldsDrawerOpen = open;
    },
    worlds,
    activeWorld: worldName,
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
