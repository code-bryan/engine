import { World } from "@engine/ecs-core";
import { createKeyboardInputSys } from "@engine/input";
import { createEngineApplication } from "@engine/renderer";
import { createMovementSystem, createPlayerControlSystem, EnemyPrefab, PlayerPrefab } from "./prefabs";

const world = new World();
PlayerPrefab(world, { x: 32, y: 64 });
EnemyPrefab(world, { x: 220, y: 64 });

world.addSystem(createKeyboardInputSys());
world.addSystem(createPlayerControlSystem());
world.addSystem(createMovementSystem());

const engine = await createEngineApplication({
  world,
  mount: document.body,
  pixi: { width: 320, height: 180, background: 0x2c2c38 },
});

engine.start();
