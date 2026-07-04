import { sprite, transforms } from "@engine/renderer";
import type { GameWorld } from "../app";
import { players, velocities } from "../components";

export function PlayerPrefab(world: GameWorld, props: { x: number; y: number }) {
  const e = world.spawn();
  world.tags.add(e, "player");
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  players.set(e, { speed: 96, spawnX: props.x, spawnY: props.y });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: 16, height: 16 });
  sprite.set(e, { tint: 0x68d391 });
  return e;
}
