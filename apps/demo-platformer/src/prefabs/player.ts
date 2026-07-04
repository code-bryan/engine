import { loadSpriteSheet, sprite, transforms, type SpriteAnimationFrame } from "@engine/renderer";
import type { GameWorld } from "../app";
import { facings, players, velocities } from "../components";

const playerFrames = loadPlayerFrames();

async function loadPlayerFrames() {
  const textures = await loadSpriteSheet({ src: "/assets/Orc_Walk.png", frameWidth: 100, frameHeight: 100, frames: 8 });
  return textures.map((texture) => ({ texture }));
}

export async function PlayerPrefab(world: GameWorld, props: { x: number; y: number }) {
  const e = world.spawn();
  world.tags.add(e, "player");
  transforms.set(e, { x: props.x, y: props.y, scale: 1 });
  velocities.set(e, { x: 0, y: 0 });
  facings.set(e, "right");
  players.set(e, { speed: 96, spawnX: props.x, spawnY: props.y });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: 16, height: 16 });
  const frames = await playerFrames;
  sprite.set(e, frames[0]);
  sprite.animation.set(e, {
    fps: 8,
    frames,
  });
  return e;
}
