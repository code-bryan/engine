import { expect, test } from "bun:test";
import { World } from "@engine/ecs-core";
import { transforms } from "@engine/components";
import { registerComponentDefinition, getComponentStore } from "./components";
import { instantiateEntity } from "./prefabs";
import { parseDemoWorldData } from "./worlds";
import type { DemoGameWorld } from "./types";

registerComponentDefinition({ version: 1, id: "speed", label: "Speed", kind: "scalar", defaultValue: 96 });

test("instantiateEntity spawns a prefab-less entity from inline components", async () => {
  const world = new World() as DemoGameWorld;
  const entity = await instantiateEntity(world, {
    components: {
      tag: "thing",
      transform: { position: { x: 5, y: 6 }, rotation: 0, scale: { x: 1, y: 1 } },
      speed: 42,
    },
  });

  expect(world.tags.has(entity, "thing")).toBe(true);
  expect(transforms.get(entity)?.position).toEqual({ x: 5, y: 6 });
  expect(getComponentStore<number>("speed").get(entity)).toBe(42);
});

test("parseDemoWorldData accepts the new components-first shape", () => {
  const parsed = parseDemoWorldData({
    version: 1,
    systems: [],
    entities: [
      { extends: "player", components: { transform: { position: { x: 1, y: 2 }, rotation: 0, scale: { x: 1, y: 1 } }, facing: "right" } },
    ],
  });
  expect(parsed?.entities[0].extends).toBe("player");
  expect(parsed?.entities[0].components.facing).toBe("right");
});

test("parseDemoWorldData still parses the legacy prefab shape (prefab→extends, transform folded in)", () => {
  const parsed = parseDemoWorldData({
    version: 1,
    systems: [],
    entities: [
      { prefab: "enemy", transform: { position: { x: 3, y: 4 }, rotation: 0, scale: { x: 1, y: 1 } }, components: { facing: "left" } },
    ],
  });
  const entity = parsed?.entities[0];
  expect(entity?.extends).toBe("enemy");
  expect((entity?.components.transform as { position: { x: number; y: number } }).position).toEqual({ x: 3, y: 4 });
  expect(entity?.components.facing).toBe("left");
});
