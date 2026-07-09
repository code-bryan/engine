import { test, expect } from "bun:test";
import {
  clamp,
  edgeKey,
  moveGraphNode,
  computeGraphBounds,
  parseEditableValue,
  formatEditableValue,
} from "./graph-math";
import type { GraphAsset } from "./graph-asset";

function graph(nodes: Array<{ id: string; type: string; x: number; y: number }>): GraphAsset {
  return {
    version: 3,
    name: "g",
    entrypoint: nodes[0]?.id ?? "n0",
    variables: [],
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: { x: n.x, y: n.y }, data: {} })),
    edges: [],
  } as unknown as GraphAsset;
}

test("clamp bounds a value", () => {
  expect(clamp(5, 0, 3)).toBe(3);
  expect(clamp(-1, 0, 3)).toBe(0);
  expect(clamp(2, 0, 3)).toBe(2);
});

test("edgeKey encodes both endpoints", () => {
  expect(edgeKey({ from: { node: "a", port: "out" }, to: { node: "b", port: "in" } } as any)).toBe("a:out->b:in");
});

test("moveGraphNode shifts and rounds only the target node", () => {
  const g = graph([{ id: "n1", type: "OnUpdate", x: 10.2, y: 20.8 }, { id: "n2", type: "Log", x: 0, y: 0 }]);
  const moved = moveGraphNode(g, "n1", 5.4, -3.1);
  expect(moved.nodes[0].position).toEqual({ x: 16, y: 18 });
  expect(moved.nodes[1].position).toEqual({ x: 0, y: 0 });
  expect(g.nodes[0].position).toEqual({ x: 10.2, y: 20.8 }); // input untouched
});

test("computeGraphBounds falls back to a default box for empty graphs", () => {
  expect(computeGraphBounds(graph([]))).toEqual({ x: 0, y: 0, width: 1400, height: 900 });
});

test("parseEditableValue coerces per field type", () => {
  expect(parseEditableValue("5", "number" as any)).toBe(5);
  expect(parseEditableValue("nope", "number" as any)).toBe(0);
  expect(parseEditableValue("true", "boolean" as any)).toBe(true);
  expect(parseEditableValue('{"a":1}', "json" as any)).toEqual({ a: 1 });
  expect(parseEditableValue("hi", "string" as any)).toBe("hi");
});

test("formatEditableValue is the inverse-ish for display", () => {
  expect(formatEditableValue(undefined, "number" as any)).toBe("");
  expect(formatEditableValue(5, "number" as any)).toBe("5");
  expect(formatEditableValue({ a: 1 }, "json" as any)).toBe(JSON.stringify({ a: 1 }, null, 2));
});
