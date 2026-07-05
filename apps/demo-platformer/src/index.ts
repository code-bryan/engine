import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import { attachDebugEditor } from "./debug/editor";
import { Level01 } from "./levels";

const world = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));

await Level01(world);

const shell = document.createElement("main");
shell.className = "app-shell";
document.body.appendChild(shell);

const viewport = document.createElement("section");
viewport.className = "game-frame";
shell.appendChild(viewport);

const engine = await createEngineApplication({
  world,
  mount: viewport,
  pixi: { width: 320, height: 180, background: 0x2c2c38 },
});

attachDebugEditor(world, engine);

engine.start();
