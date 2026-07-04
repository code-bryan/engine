import { createKeyboardInputSys } from "@engine/input";
import { loadSpriteSheet } from "@engine/renderer";
import type { GameWorld } from "../app";
import { EnemyPrefab, PlayerPrefab } from "../prefabs";
import {
  createEnemyFollowSystem,
  createPlayerControlSystem,
  createRestartOnEnemyTouchSystem,
  createSpriteFacingSystem,
} from "../systems";

export async function Level01(world: GameWorld) {
  const [playerFrames, enemyFrames] = await Promise.all([
    loadSpriteSheet({ src: "/assets/Orc_Walk.png", frameWidth: 100, frameHeight: 100, frames: 8 }),
    loadSpriteSheet({ src: "/assets/Soldier_Walk.png", frameWidth: 100, frameHeight: 100, frames: 8 }),
  ]);

  PlayerPrefab(world, { x: 32, y: 64, frames: playerFrames.map((texture) => ({ texture })) });
  EnemyPrefab(world, { x: 220, y: 64, frames: enemyFrames.map((texture) => ({ texture })) });

  world.addSystem(createKeyboardInputSys());
  world.addSystem(createPlayerControlSystem(world));
  world.addSystem(createEnemyFollowSystem(world));
  world.addSystem(createSpriteFacingSystem());
  world.addSystem(world.physics.createSystem());
  world.addSystem(createRestartOnEnemyTouchSystem(world));
}
