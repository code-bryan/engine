import { test, expect } from "bun:test";
import { formatWorldEvent, formatPhysicsEvent, stableSerialize } from "./format";

const world = { tags: { list: () => ["player"] } } as any;

test("stableSerialize sorts object keys deterministically", () => {
  expect(stableSerialize({ b: 1, a: 2 })).toBe(stableSerialize({ a: 2, b: 1 }));
  expect(stableSerialize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
});

test("stableSerialize handles Sets and primitives", () => {
  expect(stableSerialize(new Set([3, 1, 2]))).toBe("[1,2,3]");
  expect(stableSerialize(42)).toBe("42");
  expect(stableSerialize("hi")).toBe("hi");
  expect(stableSerialize(undefined)).toBe("undefined");
});

test("formatWorldEvent labels entity spawn", () => {
  expect(formatWorldEvent(world, { type: "entity:spawn", frame: 3, entity: 1 } as any)).toEqual({
    cat: "entity",
    text: "frame 3 spawn player_1",
  });
});

test("formatWorldEvent returns null for unhandled events", () => {
  expect(formatWorldEvent(world, { type: "frame:end", frame: 1, dt: 0, durationMs: 0 } as any)).toBeNull();
});

test("formatPhysicsEvent describes a collision", () => {
  const out = formatPhysicsEvent(world, { type: "collision:start", entities: [1, 2] } as any);
  expect(out.cat).toBe("collision");
  expect(out.text).toContain("collision start");
});
