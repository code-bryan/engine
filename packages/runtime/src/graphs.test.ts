import { expect, test } from "bun:test";
import fs from "node:fs";
import { World } from "@engine/ecs-core";
import { keyboard } from "@engine/input";
import { transforms } from "@engine/components";
import { registerComponentDefinition } from "./components";
import { getComponentStore } from "./components";
import { createGraphSystem, type GraphDefinition } from "./graphs";
import type { DemoGameWorld } from "./types";

const probeComponentId = "probe-signal-test";
registerComponentDefinition({
  version: 1,
  id: probeComponentId,
  label: "Probe Signal Test",
  defaultValue: 0,
});

test("graph variables seed defaults and signals cross graphs", async () => {
  const world = new World() as DemoGameWorld;
  const velocityCalls: Array<{ x: number; y: number }> = [];
  world.physics = {
    setVelocity(_entity: unknown, velocity: { x: number; y: number }) {
      velocityCalls.push({ ...velocity });
    },
    reset() {},
    collider() {
      return { collide() { return false; } };
    },
  } as unknown as DemoGameWorld["physics"];

  const listener = world.spawn();
  world.tags.add(listener, "listener");

  const emitGraph: GraphDefinition = {
    version: 3,
    name: "emit-signal",
    entrypoint: "11111111-1111-4111-8111-111111111111",
    variables: [
      {
        name: "payload",
        scope: "private",
        type: "number",
        default: 42,
      },
    ],
    nodes: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        type: "OnUpdate",
        position: { x: 0, y: 0 },
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "GetVariable",
        position: { x: 180, y: 0 },
        data: { variable: "payload" },
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "EmitSignal",
        position: { x: 360, y: 0 },
        data: { signal: "ping" },
      },
    ],
    edges: [
      {
        from: { node: "11111111-1111-4111-8111-111111111111", port: "flow" },
        to: { node: "22222222-2222-4222-8222-222222222222", port: "flow" },
      },
      {
        from: { node: "22222222-2222-4222-8222-222222222222", port: "flow" },
        to: { node: "33333333-3333-4333-8333-333333333333", port: "flow" },
      },
      {
        from: { node: "22222222-2222-4222-8222-222222222222", port: "value" },
        to: { node: "33333333-3333-4333-8333-333333333333", port: "payload" },
      },
    ],
  };

  const listenGraph: GraphDefinition = {
    version: 3,
    name: "listen-signal",
    entrypoint: "44444444-4444-4444-8444-444444444444",
    variables: [],
    nodes: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        type: "OnUpdate",
        position: { x: 0, y: 0 },
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        type: "OnSignal",
        position: { x: 0, y: 160 },
        data: { signal: "ping" },
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        type: "ForEachEntityWithTag",
        position: { x: 180, y: 160 },
        data: { tag: "listener" },
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        type: "SetComponent",
        position: { x: 360, y: 160 },
        data: { component: probeComponentId },
      },
    ],
    edges: [
      {
        from: { node: "55555555-5555-4555-8555-555555555555", port: "flow" },
        to: { node: "66666666-6666-4666-8666-666666666666", port: "flow" },
      },
      {
        from: { node: "66666666-6666-4666-8666-666666666666", port: "flow" },
        to: { node: "77777777-7777-4777-8777-777777777777", port: "flow" },
      },
    ],
  };

  const runListen = await createGraphSystem(world, listenGraph);
  const runEmit = await createGraphSystem(world, emitGraph);

  runListen(0);
  runEmit(0);

  expect(getComponentStore<number>(probeComponentId).get(listener)).toBe(42);
});

test("SetVelocity node drives physics", async () => {
  const world = new World() as DemoGameWorld;
  const velocityCalls: Array<{ x: number; y: number }> = [];
  world.physics = {
    setVelocity(_entity: unknown, velocity: { x: number; y: number }) {
      velocityCalls.push({ ...velocity });
    },
    reset() {},
    collider() {
      return { collide() { return false; } };
    },
  } as unknown as DemoGameWorld["physics"];

  const entity = world.spawn();
  world.tags.add(entity, "player");

  const graph: GraphDefinition = {
    version: 3,
    name: "set-velocity",
    entrypoint: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    variables: [],
    nodes: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "OnUpdate",
        position: { x: 0, y: 0 },
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "ForEachEntityWithTag",
        position: { x: 180, y: 0 },
        data: { tag: "player" },
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "SetVelocity",
        position: { x: 360, y: 0 },
        data: { value: { x: 12, y: -4 } },
      },
    ],
    edges: [
      {
        from: { node: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", port: "flow" },
        to: { node: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", port: "flow" },
      },
      {
        from: { node: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", port: "flow" },
        to: { node: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", port: "flow" },
      },
    ],
  };

  const run = await createGraphSystem(world, graph);

  run(0);

  expect(velocityCalls.length).toBeGreaterThan(0);
  expect(velocityCalls.at(-1)).toEqual({ x: 12, y: -4 });
});

test("enemy follow graph from content moves the enemy", async () => {
  const world = new World() as DemoGameWorld;
  const velocityCalls: Array<{ x: number; y: number }> = [];
  world.physics = {
    setVelocity(_entity: unknown, velocity: { x: number; y: number }) {
      velocityCalls.push({ ...velocity });
    },
    reset() {},
    collider() {
      return { collide() { return false; } };
    },
    body: {
      kinematic: {
        set(entity: number, props: { x: number; y: number; width: number; height: number }) {
          void entity;
          void props;
        },
      },
      dynamic: {
        set(entity: number, props: { x: number; y: number; width: number; height: number }) {
          void entity;
          void props;
        },
      },
      static: {
        set(entity: number, props: { x: number; y: number; width: number; height: number }) {
          void entity;
          void props;
        },
      },
    },
    createSystem() {
      return () => {};
    },
  } as unknown as DemoGameWorld["physics"];

  registerComponentDefinition({
    version: 1,
    id: "speed",
    label: "Speed",
    kind: "scalar",
    defaultValue: 96,
  });

  const player = world.spawn();
  world.tags.add(player, "player");
  transforms.set(player, { position: { x: 100, y: 0 }, rotation: 0, size: { x: 0, y: 0 } });
  const enemy = world.spawn();
  world.tags.add(enemy, "enemy");
  transforms.set(enemy, { position: { x: 0, y: 0 }, rotation: 0, size: { x: 0, y: 0 } });
  getComponentStore<number>("speed").set(enemy, 42);

  const graph = JSON.parse(
    fs.readFileSync(new URL("../../../examples/platformer/content/systems/enemy-follow.json", import.meta.url), "utf8"),
  ) as GraphDefinition;
  const run = await createGraphSystem(world, graph);

  run(1 / 60);

  expect(velocityCalls.length).toBeGreaterThan(0);
  expect(velocityCalls.at(-1)).not.toEqual({ x: 0, y: 0 });
});

test("player control graph from content reads input and moves the player", async () => {
  const world = new World() as DemoGameWorld;
  const velocityCalls: Array<{ x: number; y: number }> = [];
  world.physics = {
    setVelocity(_entity: unknown, velocity: { x: number; y: number }) {
      velocityCalls.push({ ...velocity });
    },
    reset() {},
    collider() {
      return { collide() { return false; } };
    },
    body: {
      kinematic: {
        set() {},
      },
      dynamic: {
        set() {},
      },
      static: {
        set() {},
      },
    },
    createSystem() {
      return () => {};
    },
  } as unknown as DemoGameWorld["physics"];

  registerComponentDefinition({
    version: 1,
    id: "speed",
    label: "Speed",
    kind: "scalar",
    defaultValue: 96,
  });

  const player = world.spawn();
  world.tags.add(player, "player");
  getComponentStore<number>("speed").set(player, 96);
  keyboard.set(0, {
    keys: new Set(["ArrowRight"]),
    pressed: new Set(),
    released: new Set(),
  });

  const graph = JSON.parse(
    fs.readFileSync(new URL("../../../examples/platformer/content/systems/player-control.json", import.meta.url), "utf8"),
  ) as GraphDefinition;
  const run = await createGraphSystem(world, graph);

  run(1 / 60);

  expect(velocityCalls.at(-1)).toEqual({ x: 96, y: 0 });
});

test("SetPosition writes transform position and resets physics", async () => {
  const world = new World() as DemoGameWorld;
  const resetCalls: Array<{ x: number; y: number }> = [];
  world.physics = {
    reset(_entity: unknown, pos: { x: number; y: number }) {
      resetCalls.push({ ...pos });
    },
    setVelocity() {},
    collider() {
      return { collide() { return false; } };
    },
  } as unknown as DemoGameWorld["physics"];

  const entity = world.spawn();
  world.tags.add(entity, "movable");
  transforms.set(entity, { position: { x: 0, y: 0 }, rotation: 0, size: { x: 0, y: 0 } });

  const graph: GraphDefinition = {
    version: 3,
    name: "set-position",
    entrypoint: "d1111111-1111-4111-8111-111111111111",
    variables: [],
    nodes: [
      { id: "d1111111-1111-4111-8111-111111111111", type: "OnUpdate", position: { x: 0, y: 0 } },
      { id: "d2222222-2222-4222-8222-222222222222", type: "ForEachEntityWithTag", position: { x: 180, y: 0 }, data: { tag: "movable" } },
      { id: "d3333333-3333-4333-8333-333333333333", type: "SetPosition", position: { x: 360, y: 0 }, data: { value: { x: 5, y: 7 } } },
    ],
    edges: [
      { from: { node: "d1111111-1111-4111-8111-111111111111", port: "flow" }, to: { node: "d2222222-2222-4222-8222-222222222222", port: "flow" } },
      { from: { node: "d2222222-2222-4222-8222-222222222222", port: "flow" }, to: { node: "d3333333-3333-4333-8333-333333333333", port: "flow" } },
    ],
  };

  const run = await createGraphSystem(world, graph);
  run(0);

  expect(transforms.get(entity)?.position).toEqual({ x: 5, y: 7 });
  expect(resetCalls.at(-1)).toEqual({ x: 5, y: 7 });
});
