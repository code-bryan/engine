import { expect, test } from "bun:test";
import fs from "node:fs";
import { World } from "@engine/ecs-core";
import { spriteAnimations } from "@engine/renderer";
import { registerComponentDefinition, getComponentStore } from "./components";
import { createGraphSystem, type GraphDefinition } from "./graphs";
import type { DemoGameWorld } from "./types";

registerComponentDefinition({ version: 1, id: "actor-state", label: "Actor State", defaultValue: "idle" });

function makePlayer(world: DemoGameWorld) {
  const player = world.spawn();
  world.tags.add(player, "player");
  // Set up a sprite animation store entry (no Pixi sprite needed for state switching).
  spriteAnimations.set(player, {
    clips: {
      idle: { fps: 4, loop: true, frames: [{}, {}] },
      walk: { fps: 8, loop: true, frames: [{}, {}] },
    },
    state: "idle",
    elapsed: 0,
    current: 0,
    playing: true,
  } as never);
  return player;
}

const graph = JSON.parse(
  fs.readFileSync(new URL("../../../examples/platformer/content/systems/actor-state.json", import.meta.url), "utf8"),
) as GraphDefinition;

test("actor-state graph switches sprite animation to walk when moving", async () => {
  const world = new World() as DemoGameWorld;
  world.physics = { setVelocity() {}, reset() {}, getVelocity() { return { x: 96, y: 0 }; }, collider() { return { collide() { return false; } }; } } as unknown as DemoGameWorld["physics"];
  const player = makePlayer(world);

  const run = await createGraphSystem(world, graph);
  run(1 / 60);

  expect(spriteAnimations.get(player)?.state).toBe("walk");
  // SetComponent must write its own literal, not any upstream value.
  expect(getComponentStore<string>("actor-state").get(player)).toBe("walk");
});

test("actor-state graph switches sprite animation to idle when still", async () => {
  const world = new World() as DemoGameWorld;
  world.physics = { setVelocity() {}, reset() {}, getVelocity() { return { x: 0, y: 0 }; }, collider() { return { collide() { return false; } }; } } as unknown as DemoGameWorld["physics"];
  const player = makePlayer(world);
  // start on walk so we can observe the switch back to idle
  spriteAnimations.get(player)!.state = "walk";

  const run = await createGraphSystem(world, graph);
  run(1 / 60);

  expect(spriteAnimations.get(player)?.state).toBe("idle");
  expect(getComponentStore<string>("actor-state").get(player)).toBe("idle");
});
