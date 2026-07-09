import { test, expect } from "bun:test";
import { reduce } from "./reducer";
import type { DebugState } from "./types";
import { ALL_LOG_CATEGORIES } from "../shared/types";

function base(overrides: Partial<DebugState> = {}): DebugState {
  return {
    selectedEntity: undefined,
    latestFrame: 0,
    latestDt: 0,
    latestFrameMs: 0,
    fps: 0,
    systemMetrics: [],
    systemTimingHistory: new Map(),
    eventLog: [],
    logFilter: new Set(ALL_LOG_CATEGORIES),
    logPaused: false,
    snapshots: [],
    collapsedComponents: new Set(),
    showGrid: true,
    showPhysics: false,
    showLabels: false,
    showSprites: false,
    camera: { x: 0, y: 0, zoom: 1 },
    cameraZoomSensitivity: 2.5,
    lockTarget: undefined,
    toolMode: "select",
    entityQuery: "",
    inspectorQuery: "",
    openDropdown: undefined,
    contentDrawerOpen: false,
    openWorlds: [],
    openDocs: [],
    activeDoc: null,
    sceneSelected: false,
    snapGrid: true,
    snapGridSize: 16,
    snapRotate: true,
    snapRotateDeg: 15,
    worldDirty: false,
    toasts: [],
    toastSeq: 0,
    ...overrides,
  };
}

test("select-entity clears scene selection", () => {
  const next = reduce(base({ sceneSelected: true }), { type: "select-entity", entity: 7 });
  expect(next.selectedEntity).toBe(7);
  expect(next.sceneSelected).toBe(false);
});

test("select-scene clears entity", () => {
  const next = reduce(base({ selectedEntity: 3 }), { type: "select-scene" });
  expect(next.sceneSelected).toBe(true);
  expect(next.selectedEntity).toBeUndefined();
});

test("toggle-debug-menu opens then closes", () => {
  const opened = reduce(base(), { type: "toggle-debug-menu" });
  expect(opened.openDropdown).toBe("debug");
  expect(reduce(opened, { type: "toggle-debug-menu" }).openDropdown).toBeUndefined();
});

test("set-zoom-sensitivity clamps to [1,8]", () => {
  expect(reduce(base(), { type: "set-zoom-sensitivity", value: 99 }).cameraZoomSensitivity).toBe(8);
  expect(reduce(base(), { type: "set-zoom-sensitivity", value: -5 }).cameraZoomSensitivity).toBe(1);
});

test("set-grid-snap-size ignores non-finite and clamps finite", () => {
  expect(reduce(base(), { type: "set-grid-snap-size", value: Number.NaN }).snapGridSize).toBe(16);
  expect(reduce(base(), { type: "set-grid-snap-size", value: 9999 }).snapGridSize).toBe(512);
  expect(reduce(base(), { type: "set-grid-snap-size", value: 24.6 }).snapGridSize).toBe(25);
});

test("toggle-log-filter removes then re-adds a category immutably", () => {
  const start = base();
  const removed = reduce(start, { type: "toggle-log-filter", cat: "physics" });
  expect(removed.logFilter.has("physics")).toBe(false);
  expect(start.logFilter.has("physics")).toBe(true); // original untouched
  expect(reduce(removed, { type: "toggle-log-filter", cat: "physics" }).logFilter.has("physics")).toBe(true);
});

test("push-log dedupes consecutive identical entries by incrementing count", () => {
  const s = base();
  reduce(s, { type: "push-log", entry: { cat: "entity", text: "spawn" } });
  reduce(s, { type: "push-log", entry: { cat: "entity", text: "spawn" } });
  expect(s.eventLog.length).toBe(1);
  expect(s.eventLog[0].count).toBe(2);
});

test("push-log respects pause and null entries", () => {
  const paused = base({ logPaused: true });
  reduce(paused, { type: "push-log", entry: { cat: "entity", text: "x" } });
  expect(paused.eventLog.length).toBe(0);
  const s = base();
  reduce(s, { type: "push-log", entry: null });
  expect(s.eventLog.length).toBe(0);
});

test("add-snapshot prepends and caps at 5", () => {
  let s = base();
  for (let i = 0; i < 7; i++) s = reduce(s, { type: "add-snapshot", snapshot: { frame: i, entities: new Map() } });
  expect(s.snapshots.length).toBe(5);
  expect(s.snapshots[0].frame).toBe(6); // most recent first
});

test("close-doc picks a sensible next active doc", () => {
  const s = base({
    openDocs: [{ path: "a", kind: "graph" }, { path: "b", kind: "graph" }, { path: "c", kind: "graph" }],
    activeDoc: "b",
  });
  const next = reduce(s, { type: "close-doc", path: "b" });
  expect(next.openDocs.map((d) => d.path)).toEqual(["a", "c"]);
  expect(next.activeDoc).toBe("c");
});

test("set-world-dirty toggles the flag and is a no-op when unchanged", () => {
  const dirty = reduce(base(), { type: "set-world-dirty", dirty: true });
  expect(dirty.worldDirty).toBe(true);
  const same = reduce(dirty, { type: "set-world-dirty", dirty: true });
  expect(same).toBe(dirty); // no new object when value is unchanged
  expect(reduce(dirty, { type: "set-world-dirty", dirty: false }).worldDirty).toBe(false);
});

test("add-toast appends with a fresh id", () => {
  const a = reduce(base(), { type: "add-toast", toast: { kind: "success", title: "Saved", description: "world-01" } });
  expect(a.toasts).toHaveLength(1);
  expect(a.toasts[0]).toMatchObject({ id: 1, kind: "success", title: "Saved", description: "world-01", version: 0 });
  const b = reduce(a, { type: "add-toast", toast: { kind: "info", title: "Note" } });
  expect(b.toasts.map((t) => t.id)).toEqual([1, 2]);
});

test("add-toast coalesces by key in place, bumping version (no stacking)", () => {
  const a = reduce(base(), { type: "add-toast", toast: { kind: "success", title: "Saved", description: "a", coalesceKey: "file:a" } });
  const b = reduce(a, { type: "add-toast", toast: { kind: "success", title: "Saved", description: "a2", coalesceKey: "file:a" } });
  expect(b.toasts).toHaveLength(1);
  expect(b.toasts[0]).toMatchObject({ id: 1, description: "a2", version: 1 });
});

test("add-toast with a different key stacks separately", () => {
  const a = reduce(base(), { type: "add-toast", toast: { kind: "success", title: "Saved", coalesceKey: "file:a" } });
  const b = reduce(a, { type: "add-toast", toast: { kind: "success", title: "Saved", coalesceKey: "file:b" } });
  expect(b.toasts).toHaveLength(2);
});

test("dismiss-toast removes by id", () => {
  const a = reduce(base(), { type: "add-toast", toast: { kind: "info", title: "x" } });
  expect(reduce(a, { type: "dismiss-toast", id: 1 }).toasts).toHaveLength(0);
});

test("frame telemetry mutates in place (same reference)", () => {
  const s = base();
  const out = reduce(s, { type: "frame-end", frame: 10, dt: 0.016, durationMs: 2, fps: 60 });
  expect(out).toBe(s);
  expect(s.fps).toBe(60);
  expect(s.latestFrameMs).toBe(2);
});
