import { transforms } from "@engine/renderer";
import type { GameWorld } from "../../app";
import { enemies, players, velocities } from "../components";

export function createRestartOnEnemyTouchSystem(world: GameWorld) {
  return () => {
    for (const playerEntity of world.tags.with("player")) {
      const player = world.physics.collider(world, playerEntity);
      if (!player.collide("enemy")) continue;
      resetGame(world);
      return;
    }
  };
}

function resetGame(world: GameWorld) {
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
