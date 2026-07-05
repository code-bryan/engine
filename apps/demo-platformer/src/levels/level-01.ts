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

  world.addSystem("keyboard-input", createKeyboardInputSys());
  world.addSystem("player-control", createPlayerControlSystem(world));
  world.addSystem("enemy-follow", createEnemyFollowSystem(world));
  world.addSystem("actor-state", createActorStateSystem());
  world.addSystem("sprite-facing", createSpriteFacingSystem());
  world.addSystem("physics", world.physics.createSystem());
  world.addSystem("restart-on-enemy-touch", createRestartOnEnemyTouchSystem(world));
}
