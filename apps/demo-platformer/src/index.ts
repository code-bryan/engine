import { createKeyboardInputSys } from "@engine/input";
import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import { GameWorld } from "./app";
import {
  createEnemyFollowSystem,
  createPlayerControlSystem,
  EnemyPrefab,
  PlayerPrefab,
  createRestartOnEnemyTouchSystem,
} from "./prefabs";

const world = new GameWorld(createPhysics({ gravity: { x: 0, y: 0 } }));

PlayerPrefab(world, { x: 32, y: 64 });
EnemyPrefab(world, { x: 220, y: 64 });

world.addSystem(createKeyboardInputSys());
world.addSystem(createPlayerControlSystem(world));
world.addSystem(createEnemyFollowSystem(world));
world.addSystem(world.physics.createSystem());
world.addSystem(createRestartOnEnemyTouchSystem(world));

const engine = await createEngineApplication({
  world,
  mount: document.body,
  pixi: { width: 320, height: 180, background: 0x2c2c38 },
});

engine.start();
