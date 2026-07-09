// The editor's UI state and the action union that mutates it. `DebugState` is the
// single source of truth for everything the React tree renders; `EditorAction` is
// the only vocabulary for changing it (see ./reducer). I/O and engine side effects
// are NOT actions — they stay as injected effect callbacks in the platform layer.

import type { Entity } from "@engine/ecs-core";
import type {
  EditorToolMode,
  FrameMetric,
  LogCategory,
  LogEntry,
  WorldSnapshot,
} from "../shared/types";

export type DebugState = {
  selectedEntity?: Entity;
  latestFrame: number;
  latestDt: number;
  latestFrameMs: number;
  fps: number;
  systemMetrics: FrameMetric[];
  systemTimingHistory: Map<string, number[]>;
  eventLog: LogEntry[];
  logFilter: Set<LogCategory>;
  logPaused: boolean;
  snapshots: WorldSnapshot[];
  collapsedComponents: Set<string>;
  showGrid: boolean;
  showPhysics: boolean;
  showLabels: boolean;
  showSprites: boolean;
  camera: { x: number; y: number; zoom: number };
  cameraZoomSensitivity: number;
  lockTarget: Entity | undefined;
  toolMode: EditorToolMode;
  entityQuery: string;
  inspectorQuery: string;
  openDropdown: string | undefined;
  contentDrawerOpen: boolean;
  openWorlds: string[];
  openDocs: Array<{ path: string; kind: "graph" | "component" }>;
  activeDoc: string | null;
  sceneSelected: boolean;
  snapGrid: boolean;
  snapGridSize: number;
  snapRotate: boolean;
  snapRotateDeg: number;
  // Unreal-style: in-editor changes to the active world mark it dirty (in memory)
  // rather than writing to disk; an explicit save (⌘/Ctrl+S) persists and clears it.
  worldDirty: boolean;
  // Transient notification toasts (newest last). `toastSeq` hands out stable ids;
  // `version` bumps when a coalesced toast is refreshed so the UI can reset its
  // auto-hide timer without remounting (e.g. a burst of saves during a drag).
  toasts: EditorToast[];
  toastSeq: number;
};

export type EditorToastKind = "success" | "error" | "info";

export type EditorToast = {
  id: number;
  kind: EditorToastKind;
  title: string;
  description?: string;
  coalesceKey?: string;
  version: number;
};

export type EditorAction =
  // selection
  | { type: "select-entity"; entity: Entity | undefined }
  | { type: "select-scene" }
  | { type: "reset-selection" } // world switch: clear entity/scene/lock
  // tools
  | { type: "set-tool"; mode: EditorToolMode }
  // camera
  | { type: "set-camera"; camera: { x: number; y: number; zoom: number } }
  | { type: "set-lock"; target: Entity | undefined }
  | { type: "set-zoom-sensitivity"; value: number }
  // overlay show-flags
  | { type: "toggle-grid" }
  | { type: "toggle-physics" }
  | { type: "toggle-labels" }
  | { type: "toggle-sprites" }
  // menus / drawer
  | { type: "toggle-debug-menu" }
  | { type: "close-menus" }
  | { type: "set-content-drawer"; open: boolean }
  // snapping
  | { type: "toggle-grid-snap" }
  | { type: "set-grid-snap-size"; value: number }
  | { type: "toggle-rotation-snap" }
  | { type: "set-rotation-snap-deg"; value: number }
  // queries
  | { type: "set-entity-query"; value: string }
  | { type: "set-inspector-query"; value: string }
  // inspector
  | { type: "toggle-component-collapse"; id: string }
  // log
  | { type: "toggle-log-filter"; cat: LogCategory }
  | { type: "toggle-log-pause" }
  | { type: "push-log"; entry: Omit<LogEntry, "count"> | null }
  // snapshots
  | { type: "add-snapshot"; snapshot: WorldSnapshot }
  // docs (graph/component tabs)
  | { type: "open-doc"; path: string; kind: "graph" | "component" }
  | { type: "close-doc"; path: string }
  | { type: "select-doc"; path: string }
  | { type: "set-active-doc"; value: string | null }
  // world tabs
  | { type: "add-open-world"; path: string }
  | { type: "remove-open-world"; path: string }
  // path remap after a content rename (updates open world/doc tabs in place)
  | { type: "rename-path"; from: string; to: string }
  // dirty tracking
  | { type: "set-world-dirty"; dirty: boolean }
  // toasts
  | { type: "add-toast"; toast: { kind: EditorToastKind; title: string; description?: string; coalesceKey?: string } }
  | { type: "dismiss-toast"; id: number }
  // per-frame telemetry (dispatched silently — see store.applySilent)
  | { type: "frame-start"; frame: number; dt: number }
  | { type: "system-run"; label: string; durationMs: number }
  | { type: "frame-end"; frame: number; dt: number; durationMs: number; fps: number };
