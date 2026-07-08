import { World } from "@engine/ecs-core";
import type { Physics } from "@engine/physics";

export class GameWorld extends World {
  constructor(public physics: Physics) {
    super();
  }
}
