import type { World } from "@engine/ecs-core";
import { createStore } from "@engine/ecs-core";
import { attachSprite, transforms } from "@engine/renderer";

export type Velocity = { x: number; y: number };
export const velocities = createStore<Velocity>();

export function PlayerPrefab(world: World, props: { x: number; y: number }) {
  const e = world.spawn();
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  attachSprite(e).tint = 0x68d391;
  return e;
}

export function EnemyPrefab(world: World, props: { x: number; y: number }) {
  const e = world.spawn();
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: -10, y: 0 });
  attachSprite(e).tint = 0xfc8181;
  return e;
}
