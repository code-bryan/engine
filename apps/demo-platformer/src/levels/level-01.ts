import { createKeyboardInputSys } from "@engine/input";
import type { GameWorld } from "../app";
import { EnemyPrefab, PlayerPrefab } from "../prefabs";
import {
  createActorStateSystem,
  createEnemyFollowSystem,
  createPlayerControlSystem,
  createRestartOnEnemyTouchSystem,
  createSpriteFacingSystem,
} from "../systems";

export async function Level01(world: GameWorld) {
  await Promise.all([
    PlayerPrefab(world, { x: 32, y: 64 }),
    EnemyPrefab(world, { x: 220, y: 64 }),
  ]);

  world.addSystem(createKeyboardInputSys());
  world.addSystem(createPlayerControlSystem(world));
  world.addSystem(createEnemyFollowSystem(world));
  world.addSystem(createActorStateSystem());
  world.addSystem(createSpriteFacingSystem());
  world.addSystem(world.physics.createSystem());
  world.addSystem(createRestartOnEnemyTouchSystem(world));
}
