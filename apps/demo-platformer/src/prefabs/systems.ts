import { keyboard } from "@engine/input";
import { transforms } from "@engine/renderer";
import { enemies, players, velocities } from "./components";

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

export function createEnemyFollowSystem() {
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

export function createRestartOnEnemyTouchSystem() {
  return () => {
    for (const [playerEntity, player] of players) {
      const playerTransform = transforms.get(playerEntity);
      if (!playerTransform) continue;

      for (const enemyEntity of enemies.keys()) {
        const enemyTransform = transforms.get(enemyEntity);
        if (!enemyTransform || !isTouching(playerTransform, enemyTransform)) continue;

        resetGame();
        return;
      }
    }
  };
}

function isTouching(a: { x: number; y: number; scale?: number }, b: { x: number; y: number; scale?: number }) {
  const aSize = a.scale ?? 1;
  const bSize = b.scale ?? 1;

  return (
    a.x < b.x + bSize &&
    a.x + aSize > b.x &&
    a.y < b.y + bSize &&
    a.y + aSize > b.y
  );
}

function resetGame() {
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
  }
}
