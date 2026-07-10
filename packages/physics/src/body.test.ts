import { test, expect } from "bun:test";
import { Physics } from "./index";

test("setBody centers the collider on the given position", () => {
  const physics = new Physics({ gravity: { x: 0, y: 0 } });
  physics.body.kinematic.set(1, { x: 100, y: 50, width: 16, height: 16 });
  const body = physics.getDebugBody(1)!;
  // getDebugBody returns the collider's top-left; its center must equal the
  // position we passed (position = entity center convention).
  expect(body.x + body.width / 2).toBeCloseTo(100, 5);
  expect(body.y + body.height / 2).toBeCloseTo(50, 5);
});

test("getBodyConfig round-trips body type, trigger, mass and material", () => {
  const physics = new Physics({ gravity: { x: 0, y: 0 } });
  physics.setBody(1, { x: 0, y: 0, width: 20, height: 10, kind: "dynamic", isTrigger: true, mass: 5, friction: 0.3, restitution: 0.2, frictionAir: 0.05 });
  const cfg = physics.getBodyConfig(1)!;
  expect(cfg.kind).toBe("dynamic");
  expect(cfg.isTrigger).toBe(true);
  expect(cfg.mass).toBe(5);
  expect(cfg.friction).toBeCloseTo(0.3, 5);
  expect(cfg.restitution).toBeCloseTo(0.2, 5);
  expect(cfg.frictionAir).toBeCloseTo(0.05, 5);
});

test("isTrigger defaults to the legacy kinematic-is-sensor rule when unset", () => {
  const physics = new Physics({ gravity: { x: 0, y: 0 } });
  physics.setBody(1, { x: 0, y: 0, width: 16, height: 16, kind: "kinematic" });
  expect(physics.getBodyConfig(1)!.isTrigger).toBe(true);
  physics.setBody(2, { x: 0, y: 0, width: 16, height: 16, kind: "dynamic" });
  expect(physics.getBodyConfig(2)!.isTrigger).toBe(false);
  // Explicit isTrigger wins over the fallback.
  physics.setBody(3, { x: 0, y: 0, width: 16, height: 16, kind: "kinematic", isTrigger: false });
  expect(physics.getBodyConfig(3)!.isTrigger).toBe(false);
});

test("setBody replaces an entity's previous body instead of orphaning it", () => {
  const physics = new Physics({ gravity: { x: 0, y: 0 } });
  physics.setBody(1, { x: 0, y: 0, width: 16, height: 16, kind: "dynamic" });
  physics.setBody(1, { x: 0, y: 0, width: 32, height: 32, kind: "static" });
  expect(physics.getDebugBodies().filter((b) => b.entity === 1)).toHaveLength(1);
  expect(physics.getBodyConfig(1)!.kind).toBe("static");
});
