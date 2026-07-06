import type { World } from "@engine/ecs-core";
import type { Physics } from "@engine/physics";

export type DemoGameWorld = World & { physics: Physics };
