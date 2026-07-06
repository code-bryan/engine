import { createKeyboardInputSys } from "@engine/input";
import type { GameWorld } from "../../app";
import {
  createActorStateSystem,
  createEnemyFollowSystem,
  createPlayerControlSystem,
  createSpriteFacingSystem,
} from "./index";

export function bootstrapDemoSystems(world: GameWorld) {
  world.addSystem("keyboard-input", createKeyboardInputSys());
  world.addSystem("player-control", createPlayerControlSystem(world));
  world.addSystem("enemy-follow", createEnemyFollowSystem(world));
  world.addSystem("actor-state", createActorStateSystem());
  world.addSystem("sprite-facing", createSpriteFacingSystem());
  world.addSystem("physics", world.physics.createSystem());
}
