import { sprite, transforms, type SpriteAnimationFrame } from "@engine/renderer";
import type { GameWorld } from "../app";
import { facings, players, velocities } from "../components";

export function PlayerPrefab(world: GameWorld, props: { x: number; y: number; frames: SpriteAnimationFrame[] }) {
  const e = world.spawn();
  world.tags.add(e, "player");
  transforms.set(e, { x: props.x, y: props.y, scale: 1 });
  velocities.set(e, { x: 0, y: 0 });
  facings.set(e, "right");
  players.set(e, { speed: 96, spawnX: props.x, spawnY: props.y });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: 16, height: 16 });
  sprite.set(e, props.frames[0]);
  sprite.animation.set(e, {
    fps: 8,
    frames: props.frames,
  });
  return e;
}
