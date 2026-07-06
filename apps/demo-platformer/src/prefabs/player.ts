import { loadSpriteSheet, sprite, transforms, type SpriteAnimationFrame } from "@engine/renderer";
import type { GameWorld } from "../app";
import { actorStates, facings, players, velocities } from "../components";

const playerClips = loadPlayerClips();

async function loadPlayerClips() {
  const [idleTextures, walkTextures] = await Promise.all([
    loadSpriteSheet({ src: "/assets/Orc_Idle.png", frameWidth: 100, frameHeight: 100, frames: 6 }),
    loadSpriteSheet({ src: "/assets/Orc_Walk.png", frameWidth: 100, frameHeight: 100, frames: 8 }),
  ]);

  return {
    idle: idleTextures.map((texture) => ({ texture })),
    walk: walkTextures.map((texture) => ({ texture })),
  };
}

export type PlayerPrefabProps = {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  speed?: number;
  spawnX?: number;
  spawnY?: number;
};

export async function PlayerPrefab(world: GameWorld, props: PlayerPrefabProps) {
  const bodyWidth = 16;
  const bodyHeight = 16;
  const e = world.spawn();
  world.tags.add(e, "player");
  transforms.set(e, {
    x: props.x,
    y: props.y,
    rotation: props.rotation ?? 0,
    scale: props.scale ?? 1,
  });
  velocities.set(e, { x: 0, y: 0 });
  facings.set(e, "right");
  actorStates.set(e, "idle");
  players.set(e, {
    speed: props.speed ?? 96,
    spawnX: props.spawnX ?? props.x,
    spawnY: props.spawnY ?? props.y,
  });
  world.physics.body.kinematic.set(e, { x: props.x, y: props.y, width: bodyWidth, height: bodyHeight });
  const clips = await playerClips;
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
      walk: {
        fps: 8,
        loop: true,
        frames: clips.walk,
      },
    },
  });
  return e;
}
