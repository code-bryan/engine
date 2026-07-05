import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import { attachDebugEditor } from "./debug/editor";
import { Level01 } from "./levels";

const shell = document.createElement("main");
shell.className = "app-shell";
document.body.appendChild(shell);

const viewport = document.createElement("section");
viewport.className = "game-frame";
shell.appendChild(viewport);

let playbackState: "playing" | "paused" | "stopped" = "playing";
let engine: Awaited<ReturnType<typeof createEngineApplication>> | undefined;
let debuggerEditor: ReturnType<typeof attachDebugEditor> | undefined;
let world: GameWorld | undefined;

async function mountEditor(startPlaying: boolean) {
  debuggerEditor?.destroy();
  engine?.destroy();
  viewport.replaceChildren();

  world = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));
  await Level01(world);

  engine = await createEngineApplication({
    world,
    mount: viewport,
    pixi: { width: 320, height: 180, background: 0x2c2c38 },
  });

  playbackState = startPlaying ? "playing" : "stopped";
  debuggerEditor = attachDebugEditor(world, engine, {
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
      void mountEditor(false);
    },
    getState() {
      return playbackState;
    },
  });

  if (startPlaying) {
    engine.start();
  } else {
    engine.stop();
    engine.tick(0);
  }
}

await mountEditor(true);
