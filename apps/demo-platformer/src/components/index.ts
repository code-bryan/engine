import { createStore } from "@engine/ecs-core";

export type Velocity = { x: number; y: number };
export type Facing = "left" | "right";
export type ActorState = "idle" | "walk";
export type DemoTag = "player" | "enemy";

export const velocities = createStore<Velocity>();
export const facings = createStore<Facing>();
export const actorStates = createStore<ActorState>();
export const players = createStore<{ speed: number; spawnX: number; spawnY: number }>();
export const enemies = createStore<{ speed: number; spawnX: number; spawnY: number }>();
