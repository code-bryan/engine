import { loadSpriteSheet, sprite, transforms } from "@engine/renderer";
import type { GameWorld } from "../app";
import { actorStates, enemies, facings, velocities } from "../components";

const enemyClips = loadEnemyClips();

async function loadEnemyClips() {
  const idleTextures = await loadSpriteSheet({ src: "/assets/Soldier_Idle.png", frameWidth: 100, frameHeight: 100, frames: 6 });

  return {
    idle: idleTextures.map((texture) => ({ texture })),
  };
}

export type EnemyPrefabProps = {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  speed?: number;
  spawnX?: number;
  spawnY?: number;
};

export async function EnemyPrefab(world: GameWorld, props: EnemyPrefabProps) {
  const bodyWidth = 16;
  const bodyHeight = 16;
  const e = world.spawn();
  world.tags.add(e, "enemy");
  transforms.set(e, {
    x: props.x,
    y: props.y,
    rotation: props.rotation ?? 0,
    scale: props.scale ?? 1,
  });
  velocities.set(e, { x: 0, y: 0 });
  facings.set(e, "left");
  actorStates.set(e, "idle");
  enemies.set(e, {
    speed: props.speed ?? 42,
    spawnX: props.spawnX ?? props.x,
    spawnY: props.spawnY ?? props.y,
  });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: bodyWidth, height: bodyHeight });
  const clips = await enemyClips;
  sprite.set(e, {
    ...clips.idle[0],
    anchor: { x: 0.5, y: 0.5 },
    offset: { x: bodyWidth / 2, y: bodyHeight / 2 },
  });
  sprite.animation.set(e, {
    initial: "idle",
    clips: {
      idle: {
        fps: 4,
        loop: true,
        frames: clips.idle,
      },
    },
  });
  return e;
}
