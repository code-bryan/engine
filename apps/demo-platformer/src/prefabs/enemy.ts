import { loadSpriteSheet, sprite, transforms } from "@engine/renderer";
import type { GameWorld } from "../app";
import { enemies, facings, velocities } from "../components";

const enemyFrames = loadEnemyFrames();

async function loadEnemyFrames() {
  const textures = await loadSpriteSheet({ src: "/assets/Soldier_Walk.png", frameWidth: 100, frameHeight: 100, frames: 8 });
  return textures.map((texture) => ({ texture }));
}

export async function EnemyPrefab(world: GameWorld, props: { x: number; y: number }) {
  const e = world.spawn();
  world.tags.add(e, "enemy");
  transforms.set(e, { x: props.x, y: props.y, scale: 1 });
  velocities.set(e, { x: 0, y: 0 });
  facings.set(e, "left");
  enemies.set(e, { speed: 42, spawnX: props.x, spawnY: props.y });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: 16, height: 16 });
  const frames = await enemyFrames;
  sprite.set(e, frames[0]);
  sprite.animation.set(e, {
    fps: 8,
    frames,
  });
  return e;
}
