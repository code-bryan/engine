import { transforms } from "@engine/renderer";
import { getComponentStore } from "@engine/runtime";
import type { GameWorld } from "../../app";

export function createRestartOnEnemyTouchSystem(world: GameWorld) {
  const enemies = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("enemy");
  const players = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("player");
  const velocities = getComponentStore<{ x: number; y: number }>("velocity");
  return () => {
    for (const playerEntity of world.tags.with("player")) {
      const player = world.physics.collider(world, playerEntity);
      if (!player.collide("enemy")) continue;
      resetGame(world, players, enemies, velocities);
      return;
    }
  };
}

function resetGame(
  world: GameWorld,
  players: Map<number, { speed: number; spawnX: number; spawnY: number }>,
  enemies: Map<number, { speed: number; spawnX: number; spawnY: number }>,
  velocities: Map<number, { x: number; y: number }>,
) {
  for (const [e, player] of players) {
    const transform = transforms.get(e);
    const velocity = velocities.get(e);
    if (transform) {
      transform.x = player.spawnX;
      transform.y = player.spawnY;
    }
    if (velocity) {
      velocity.x = 0;
      velocity.y = 0;
    }
    world.physics.reset(e, { x: player.spawnX, y: player.spawnY });
  }

  for (const [e, enemy] of enemies) {
    const transform = transforms.get(e);
    const velocity = velocities.get(e);
    if (transform) {
      transform.x = enemy.spawnX;
      transform.y = enemy.spawnY;
    }
    if (velocity) {
      velocity.x = 0;
      velocity.y = 0;
    }
    world.physics.reset(e, { x: enemy.spawnX, y: enemy.spawnY });
  }
}
