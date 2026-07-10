import { expect, test } from "bun:test";
import { sprites, transforms } from "@engine/renderer";
import { getEntityEditorBounds } from "./bounds";
import type { DebuggerWorld } from "../../shared/types";

function stubWorld(getDebugBody: (entity: number) => { width: number; height: number } | undefined): DebuggerWorld {
  return { physics: { getDebugBody } } as unknown as DebuggerWorld;
}

test("explicit size drives the box, centered on transform.position", () => {
  transforms.set(9201, { position: { x: 10, y: 20 }, rotation: 0, size: { x: 16, y: 16 } });
  const b = getEntityEditorBounds(stubWorld(() => undefined), 9201)!;
  expect(b.width).toBe(16);
  expect(b.height).toBe(16);
  expect(b.centerX).toBe(10);
  expect(b.centerY).toBe(20);
  expect(b.x).toBe(2);
  expect(b.y).toBe(12);
});

test("negative size sizes by abs, still centered (mirror doesn't shift the box)", () => {
  transforms.set(9202, { position: { x: 5, y: 5 }, rotation: 0, size: { x: -100, y: 100 } });
  const b = getEntityEditorBounds(stubWorld(() => undefined), 9202)!;
  expect(b.width).toBe(100);
  expect(b.centerX).toBe(5);
});

test("size 0 (auto) falls back to the sprite texture size", () => {
  transforms.set(9203, { position: { x: 0, y: 0 }, rotation: 0, size: { x: 0, y: 0 } });
  sprites.set(9203, { sprite: { texture: { width: 100, height: 100 } }, offset: { x: 0, y: 0 }, anchor: { x: 0.5, y: 0.5 } } as never);
  const b = getEntityEditorBounds(stubWorld(() => undefined), 9203)!;
  expect(b.width).toBe(100);
  expect(b.height).toBe(100);
  expect(b.centerX).toBe(0);
});

test("size 0 + no sprite falls back to the physics collider", () => {
  transforms.set(9204, { position: { x: 7, y: 9 }, rotation: 0, size: { x: 0, y: 0 } });
  const b = getEntityEditorBounds(stubWorld((e) => (e === 9204 ? { width: 16, height: 16 } : undefined)), 9204)!;
  expect(b.width).toBe(16);
  expect(b.height).toBe(16);
  expect(b.centerX).toBe(7);
});

test("size 0 + no sprite/collider → 0×0 (empty marker), centered on position", () => {
  transforms.set(9205, { position: { x: 3, y: 4 }, rotation: 0, size: { x: 0, y: 0 } });
  const b = getEntityEditorBounds(stubWorld(() => undefined), 9205)!;
  expect(b.width).toBe(0);
  expect(b.height).toBe(0);
  expect(b.centerX).toBe(3);
  expect(b.centerY).toBe(4);
});

test("no transform → undefined", () => {
  expect(getEntityEditorBounds(stubWorld(() => undefined), 99999)).toBeUndefined();
});
