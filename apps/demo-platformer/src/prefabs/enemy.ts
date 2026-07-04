import type { World } from "@engine/ecs-core";
import { attachSprite, transforms } from "@engine/renderer";
import { enemies, velocities } from "./components";

export function EnemyPrefab(world: World, props: { x: number; y: number }) {
  const e = world.spawn();
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  enemies.set(e, { speed: 42, spawnX: props.x, spawnY: props.y });
  attachSprite(e).tint = 0xfc8181;
  return e;
}
