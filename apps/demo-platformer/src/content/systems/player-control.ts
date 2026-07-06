import { keyboard } from "@engine/input";
import { getComponentStore } from "@engine/runtime";
import type { GameWorld } from "../../app";

export function createPlayerControlSystem(world: GameWorld) {
  const players = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("player");
  const velocities = getComponentStore<{ x: number; y: number }>("velocity");
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
      world.physics.setVelocity(e, velocity);
    }
  };
}
