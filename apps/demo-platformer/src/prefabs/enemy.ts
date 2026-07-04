import { sprite, transforms } from "@engine/renderer";
import type { GameApplication } from "../app";
import { enemies, velocities } from "./components";

export function EnemyPrefab(app: GameApplication, props: { x: number; y: number }) {
  const e = app.world.spawn();
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  enemies.set(e, { speed: 42, spawnX: props.x, spawnY: props.y });
  app.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: 16, height: 16 });
  sprite.set(e, { tint: 0xfc8181 });
  return e;
}
