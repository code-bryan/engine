import { expect, test } from "bun:test";
import { World } from "@engine/ecs-core";
import { transforms } from "@engine/components";
import { registerComponentDefinition, getComponentStore } from "./components";
import { instantiateEntity, destroyEntity, entityFolders, entityNames, worldOrder, resetWorldOrder } from "./prefabs";
import { parseDemoWorldData, serializeWorld } from "./worlds";
import type { DemoGameWorld } from "./types";

registerComponentDefinition({ version: 1, id: "speed", label: "Speed", kind: "scalar", defaultValue: 96 });

test("instantiateEntity spawns a prefab-less entity from inline components", async () => {
  const world = new World() as DemoGameWorld;
  const entity = await instantiateEntity(world, {
    components: {
      tag: "thing",
      transform: { position: { x: 5, y: 6 }, rotation: 0, size: { x: 0, y: 0 } },
      speed: 42,
    },
  });

  expect(world.tags.has(entity, "thing")).toBe(true);
  expect(transforms.get(entity)?.position).toEqual({ x: 5, y: 6 });
  expect(getComponentStore<number>("speed").get(entity)).toBe(42);
});

test("destroyEntity tears down all stores, tags, folder and the entity itself", async () => {
  const world = new World() as DemoGameWorld;
  const entity = await instantiateEntity(world, {
    folder: "Enemies",
    components: {
      tag: "thing",
      transform: { position: { x: 5, y: 6 }, rotation: 0, size: { x: 0, y: 0 } },
      speed: 42,
    },
  });
  entityFolders.set(entity, "Enemies");

  destroyEntity(world, entity);

  expect(world.entities.has(entity)).toBe(false);
  expect(transforms.get(entity)).toBeUndefined();
  expect(getComponentStore<number>("speed").get(entity)).toBeUndefined();
  expect(world.tags.has(entity, "thing")).toBe(false);
  expect(entityFolders.get(entity)).toBeUndefined();
});

test("serializeWorld emits ordered elements with positions; empty folder persists", async () => {
  const world = new World() as DemoGameWorld;
  resetWorldOrder();
  entityFolders.clear();
  entityNames.clear();

  worldOrder.push({ kind: "folder", name: "Enemies" });
  const goblin = await instantiateEntity(world, {
    components: { tag: "enemy", transform: { position: { x: 1, y: 2 }, rotation: 0, size: { x: 0, y: 0 } } },
  });
  entityFolders.set(goblin, "Enemies");
  entityNames.set(goblin, "Goblin");
  worldOrder.push({ kind: "entity", entity: goblin });
  worldOrder.push({ kind: "folder", name: "Props" }); // empty folder

  const data = serializeWorld(world, ["movement"]);
  expect(data.systems).toEqual(["movement"]);
  expect(data.elements.map((el) => el.type)).toEqual(["folder", "entity", "folder"]);
  expect(data.elements.map((el) => el.position)).toEqual([0, 1, 2]);
  const entity = data.elements[1];
  expect(entity.type === "entity" && entity.name).toBe("Goblin");
  expect(entity.type === "entity" && entity.folder).toBe("Enemies");
  expect(data.elements[2]).toMatchObject({ type: "folder", name: "Props" });

  resetWorldOrder();
});

test("parseDemoWorldData parses the ordered elements shape (folders + entities, position preserved)", () => {
  const parsed = parseDemoWorldData({
    version: 1,
    systems: [],
    elements: [
      { type: "folder", name: "Enemies", position: 0 },
      { type: "entity", name: "Goblin", folder: "Enemies", extends: "enemy", position: 1, components: { transform: { position: { x: 1, y: 2 }, rotation: 0, size: { x: 0, y: 0 } } } },
      { type: "entity", name: "Player", extends: "player", position: 2, components: { facing: "right" } },
      { type: "folder", name: "Props", position: 3 },
    ],
  });
  expect(parsed?.elements.map((el) => el.type)).toEqual(["folder", "entity", "entity", "folder"]);
  const player = parsed?.elements[2];
  expect(player?.type === "entity" && player.name).toBe("Player");
  expect(player?.type === "entity" && player.extends).toBe("player");
  // Empty "Props" folder survives parse (persists even with no entities).
  expect(parsed?.elements[3]).toMatchObject({ type: "folder", name: "Props" });
});

test("parseDemoWorldData migrates the legacy {entities, folders} shape into ordered elements", () => {
  const parsed = parseDemoWorldData({
    version: 1,
    systems: [],
    folders: ["Level"],
    entities: [
      { prefab: "enemy", folder: "Level", transform: { position: { x: 3, y: 4 }, rotation: 0, size: { x: 0, y: 0 } }, components: { facing: "left" } },
    ],
  });
  // Folder element comes first, then the migrated entity referencing it.
  expect(parsed?.elements[0]).toMatchObject({ type: "folder", name: "Level" });
  const entity = parsed?.elements[1];
  expect(entity?.type === "entity" && entity.extends).toBe("enemy");
  expect(entity?.type === "entity" && (entity.components.transform as { position: { x: number; y: number } }).position).toEqual({ x: 3, y: 4 });
  expect(entity?.type === "entity" && entity.components.facing).toBe("left");
});
