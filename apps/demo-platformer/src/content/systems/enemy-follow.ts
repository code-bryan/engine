import { transforms } from "@engine/renderer";
import type { GameWorld } from "../../app";
import { getComponentStore } from "../components";

const enemies = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("enemy");
const players = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("player");
const velocities = getComponentStore<{ x: number; y: number }>("velocity");

export function createEnemyFollowSystem(world: GameWorld) {
  return () => {
    const playerEntity = players.keys().next().value;
    if (playerEntity === undefined) return;

    const playerTransform = transforms.get(playerEntity);
    if (!playerTransform) return;

    for (const [enemyEntity, enemy] of enemies) {
      const enemyTransform = transforms.get(enemyEntity);
      const velocity = velocities.get(enemyEntity);
      if (!enemyTransform || !velocity) continue;

      const dx = playerTransform.x - enemyTransform.x;
      const dy = playerTransform.y - enemyTransform.y;
      const distance = Math.hypot(dx, dy);

      velocity.x = distance > 0 ? (dx / distance) * enemy.speed : 0;
      velocity.y = distance > 0 ? (dy / distance) * enemy.speed : 0;
      world.physics.setVelocity(enemyEntity, velocity);
    }
  };
}
