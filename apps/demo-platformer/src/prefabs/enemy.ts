import { sprite, transforms } from "@engine/renderer";
import type { GameWorld } from "../app";
import { enemies, velocities } from "../components";

export function EnemyPrefab(world: GameWorld, props: { x: number; y: number }) {
  const e = world.spawn();
  world.tags.add(e, "enemy");
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  enemies.set(e, { speed: 42, spawnX: props.x, spawnY: props.y });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: 16, height: 16 });
  sprite.set(e, { tint: 0xfc8181 });
  return e;
}
