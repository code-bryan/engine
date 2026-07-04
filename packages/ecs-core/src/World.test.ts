import { test, expect } from "bun:test";
import { World } from "./index";

test("spawns unique entities", () => {
  const w = new World();
  expect(w.spawn()).not.toEqual(w.spawn());
});
