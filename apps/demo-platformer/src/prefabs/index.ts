import type { World } from "@engine/ecs-core";
import { createStore } from "@engine/ecs-core";
import { keyboard } from "@engine/input";
import { attachSprite, transforms } from "@engine/renderer";

export type Velocity = { x: number; y: number };
export const velocities = createStore<Velocity>();
export const players = createStore<{ speed: number }>();

export function PlayerPrefab(world: World, props: { x: number; y: number }) {
  const e = world.spawn();
  transforms.set(e, { x: props.x, y: props.y, scale: 16 });
  velocities.set(e, { x: 0, y: 0 });
  players.set(e, { speed: 96 });
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

export function createPlayerControlSystem() {
  return () => {
    const keys = keyboard.get(0)?.keys;
    if (!keys) return;

    for (const [e, player] of players) {
      const velocity = velocities.get(e);
      if (!velocity) continue;

      const x = Number(keys.has("ArrowRight") || keys.has("KeyD")) - Number(keys.has("ArrowLeft") || keys.has("KeyA"));
      const y = Number(keys.has("ArrowDown") || keys.has("KeyS")) - Number(keys.has("ArrowUp") || keys.has("KeyW"));

      velocity.x = x * player.speed;
      velocity.y = y * player.speed;
    }
  };
}

export function createMovementSystem() {
  return (dt: number) => {
    for (const [e, velocity] of velocities) {
      const transform = transforms.get(e);
      if (!transform) continue;

      transform.x += velocity.x * dt;
      transform.y += velocity.y * dt;
    }
  };
}
