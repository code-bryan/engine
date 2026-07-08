import { createKeyboardInputSys } from "@engine/input";
import { registerGraphSystems } from "@engine/runtime";
import type { GameWorld } from "../../app";

export async function bootstrapDemoSystems(world: GameWorld, systems: string[]) {
  world.addSystem("keyboard-input", createKeyboardInputSys());
  await registerGraphSystems(world, systems);
  world.addSystem("physics", world.physics.createSystem());
}
