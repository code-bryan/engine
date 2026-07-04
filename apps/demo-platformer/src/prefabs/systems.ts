import { keyboard } from "@engine/input";
import type { Physics } from "@engine/physics";
import { transforms } from "@engine/renderer";
import type { GameApplication } from "../app";
import { enemies, players, velocities } from "./components";

export function createPlayerControlSystem(physics: Physics) {
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
      physics.setVelocity(e, velocity);
    }
  };
}

export function createEnemyFollowSystem(physics: Physics) {
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
      physics.setVelocity(enemyEntity, velocity);
    }
  };
}

export function registerRestartOnEnemyTouch(app: GameApplication) {
  app.physics.onCollisionStart((a, b) => {
    const playerEnemyHit = app.world.tags.has(a, "player") && app.world.tags.has(b, "enemy");
    const enemyPlayerHit = app.world.tags.has(a, "enemy") && app.world.tags.has(b, "player");
    if (!playerEnemyHit && !enemyPlayerHit) return;

    resetGame(app.physics);
  });
}

function resetGame(physics: Physics) {
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
    physics.reset(e, { x: player.spawnX, y: player.spawnY });
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
    physics.reset(e, { x: enemy.spawnX, y: enemy.spawnY });
  }
}
