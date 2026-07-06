import { registerComponent } from "@engine/ecs-core";

export type Velocity = { x: number; y: number };
export type Facing = "left" | "right";
export type ActorState = "idle" | "walk";
export type DemoTag = "player" | "enemy";

export const velocities = registerComponent<Velocity>("velocity", "Velocity", new Map());
export const facings = registerComponent<Facing>("facing", "Facing", new Map());
export const actorStates = registerComponent<ActorState>("actor-state", "Actor State", new Map());
export const players = registerComponent<{ speed: number; spawnX: number; spawnY: number }>("player", "Player", new Map());
export const enemies = registerComponent<{ speed: number; spawnX: number; spawnY: number }>("enemy", "Enemy", new Map());
