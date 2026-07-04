import { World } from "@engine/ecs-core";
import { createKeyboardInputSys } from "@engine/input";
import { createPhysics } from "@engine/physics";
import { createEngineApplication } from "@engine/renderer";
import {
  createEnemyFollowSystem,
  createPlayerControlSystem,
  EnemyPrefab,
  PlayerPrefab,
  registerRestartOnEnemyTouch,
} from "./prefabs";

const world = new World();
const physics = createPhysics({ gravity: { x: 0, y: 0 } });
const game = { world, physics };

PlayerPrefab(game, { x: 32, y: 64 });
EnemyPrefab(game, { x: 220, y: 64 });
registerRestartOnEnemyTouch(physics);

world.addSystem(createKeyboardInputSys());
world.addSystem(createPlayerControlSystem(physics));
world.addSystem(createEnemyFollowSystem(physics));
world.addSystem(physics.createSystem());

const engine = await createEngineApplication({
  world,
  mount: document.body,
  pixi: { width: 320, height: 180, background: 0x2c2c38 },
});

engine.start();
