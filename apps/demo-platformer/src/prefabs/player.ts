import type { World } from "@engine/ecs-core";
import { attachSprite, transforms } from "@engine/renderer";
import { players, velocities } from "./components";

export function PlayerPrefab(world: World, props: { x: number; y: number }) {
  const e = world.spawn();
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  players.set(e, { speed: 96, spawnX: props.x, spawnY: props.y });
  attachSprite(e).tint = 0x68d391;
  return e;
}
