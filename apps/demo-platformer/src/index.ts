import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import { Level01 } from "./levels";

const world = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));

Level01(world);

const engine = await createEngineApplication({
  world,
  mount: document.body,
  pixi: { width: 320, height: 180, background: 0x2c2c38 },
});

engine.start();
