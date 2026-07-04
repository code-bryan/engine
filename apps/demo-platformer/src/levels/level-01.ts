import { createKeyboardInputSys } from "@engine/input";
import type { GameWorld } from "../app";
import { EnemyPrefab, PlayerPrefab } from "../prefabs";
import { createEnemyFollowSystem, createPlayerControlSystem, createRestartOnEnemyTouchSystem } from "../systems";

export function Level01(world: GameWorld) {
  PlayerPrefab(world, { x: 32, y: 64 });
  EnemyPrefab(world, { x: 220, y: 64 });

  world.addSystem(createKeyboardInputSys());
  world.addSystem(createPlayerControlSystem(world));
  world.addSystem(createEnemyFollowSystem(world));
  world.addSystem(world.physics.createSystem());
  world.addSystem(createRestartOnEnemyTouchSystem(world));
}
