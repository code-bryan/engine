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
