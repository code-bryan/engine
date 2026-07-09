// The one place editor UI state changes. Pure: (state, action) -> state. Discrete
// UI actions return a shallow-updated copy; high-frequency telemetry actions
// (frame-start / system-run / frame-end / push-log) mutate their sub-slice in
// place and return the same reference to avoid per-frame allocation.

import type { DebugState, EditorAction } from "./types";

const MIN_ZOOM_SENSITIVITY = 1;
const MAX_ZOOM_SENSITIVITY = 8;
const MAX_SNAPSHOTS = 5;
const MAX_LOG_ENTRIES = 80;
const MAX_TIMING_HISTORY = 60;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function reduce(state: DebugState, action: EditorAction): DebugState {
  switch (action.type) {
    case "select-entity":
      return { ...state, selectedEntity: action.entity, sceneSelected: false };
    case "select-scene":
      return { ...state, sceneSelected: true, selectedEntity: undefined };
    case "reset-selection":
      return { ...state, selectedEntity: undefined, sceneSelected: false, lockTarget: undefined };

    case "set-tool":
      return { ...state, toolMode: action.mode };

    case "set-camera":
      return { ...state, camera: action.camera };
    case "set-lock":
      return { ...state, lockTarget: action.target };
    case "set-zoom-sensitivity":
      return { ...state, cameraZoomSensitivity: clamp(action.value, MIN_ZOOM_SENSITIVITY, MAX_ZOOM_SENSITIVITY) };

    case "toggle-grid":
      return { ...state, showGrid: !state.showGrid };
    case "toggle-physics":
      return { ...state, showPhysics: !state.showPhysics };
    case "toggle-labels":
      return { ...state, showLabels: !state.showLabels };
    case "toggle-sprites":
      return { ...state, showSprites: !state.showSprites };

    case "toggle-debug-menu":
      return { ...state, openDropdown: state.openDropdown === "debug" ? undefined : "debug" };
    case "close-menus":
      return state.openDropdown === undefined ? state : { ...state, openDropdown: undefined };
    case "set-content-drawer":
      return { ...state, contentDrawerOpen: action.open };

    case "toggle-grid-snap":
      return { ...state, snapGrid: !state.snapGrid };
    case "set-grid-snap-size":
      return Number.isFinite(action.value)
        ? { ...state, snapGridSize: clamp(Math.round(action.value), 1, 512) }
        : state;
    case "toggle-rotation-snap":
      return { ...state, snapRotate: !state.snapRotate };
    case "set-rotation-snap-deg":
      return Number.isFinite(action.value)
        ? { ...state, snapRotateDeg: clamp(Math.round(action.value), 1, 180) }
        : state;

    case "set-entity-query":
      return { ...state, entityQuery: action.value };
    case "set-inspector-query":
      return { ...state, inspectorQuery: action.value };

    case "toggle-component-collapse": {
      const collapsedComponents = new Set(state.collapsedComponents);
      if (collapsedComponents.has(action.id)) collapsedComponents.delete(action.id);
      else collapsedComponents.add(action.id);
      return { ...state, collapsedComponents };
    }

    case "toggle-log-filter": {
      const logFilter = new Set(state.logFilter);
      if (logFilter.has(action.cat)) logFilter.delete(action.cat);
      else logFilter.add(action.cat);
      return { ...state, logFilter };
    }
    case "toggle-log-pause":
      return { ...state, logPaused: !state.logPaused };
    case "push-log": {
      // Silent, high-frequency: mutate the log in place.
      if (!action.entry || state.logPaused) return state;
      const head = state.eventLog[0];
      if (head && head.cat === action.entry.cat && head.text === action.entry.text) {
        head.count++;
        return state;
      }
      state.eventLog.unshift({ ...action.entry, count: 1 });
      if (state.eventLog.length > MAX_LOG_ENTRIES) state.eventLog.length = MAX_LOG_ENTRIES;
      return state;
    }

    case "set-world-dirty":
      return state.worldDirty === action.dirty ? state : { ...state, worldDirty: action.dirty };

    case "add-toast": {
      const { coalesceKey } = action.toast;
      // Refresh an existing toast with the same key in place (bumping version to
      // reset its timer) instead of stacking duplicates — e.g. rapid saves.
      if (coalesceKey && state.toasts.some((t) => t.coalesceKey === coalesceKey)) {
        return {
          ...state,
          toasts: state.toasts.map((t) => (
            t.coalesceKey === coalesceKey ? { ...t, ...action.toast, id: t.id, version: t.version + 1 } : t
          )),
        };
      }
      const id = state.toastSeq + 1;
      return { ...state, toastSeq: id, toasts: [...state.toasts, { id, version: 0, ...action.toast }] };
    }
    case "dismiss-toast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case "add-snapshot":
      return { ...state, snapshots: [action.snapshot, ...state.snapshots].slice(0, MAX_SNAPSHOTS) };

    case "open-doc": {
      const openDocs = state.openDocs.some((doc) => doc.path === action.path)
        ? state.openDocs
        : [...state.openDocs, { path: action.path, kind: action.kind }];
      return { ...state, openDocs, activeDoc: action.path };
    }
    case "close-doc": {
      const index = state.openDocs.findIndex((doc) => doc.path === action.path);
      const openDocs = state.openDocs.filter((doc) => doc.path !== action.path);
      const activeDoc = state.activeDoc === action.path
        ? (openDocs[index]?.path ?? openDocs[index - 1]?.path ?? null)
        : state.activeDoc;
      return { ...state, openDocs, activeDoc };
    }
    case "select-doc":
      return { ...state, activeDoc: action.path };
    case "set-active-doc":
      return { ...state, activeDoc: action.value };

    case "add-open-world":
      return state.openWorlds.includes(action.path)
        ? state
        : { ...state, openWorlds: [...state.openWorlds, action.path] };
    case "remove-open-world":
      return { ...state, openWorlds: state.openWorlds.filter((path) => path !== action.path) };

    case "rename-path": {
      // Remap the renamed path itself and anything nested under it (folder rename).
      const remap = (path: string) =>
        path === action.from
          ? action.to
          : path.startsWith(`${action.from}/`)
            ? `${action.to}/${path.slice(action.from.length + 1)}`
            : path;
      return {
        ...state,
        openWorlds: state.openWorlds.map(remap),
        openDocs: state.openDocs.map((doc) => ({ ...doc, path: remap(doc.path) })),
        activeDoc: state.activeDoc ? remap(state.activeDoc) : state.activeDoc,
      };
    }

    case "frame-start":
      // Silent telemetry: mutate in place.
      state.latestFrame = action.frame;
      state.latestDt = action.dt;
      state.systemMetrics = [];
      return state;
    case "system-run": {
      state.systemMetrics.push({ label: action.label, durationMs: action.durationMs });
      const hist = state.systemTimingHistory.get(action.label) ?? [];
      hist.push(action.durationMs);
      if (hist.length > MAX_TIMING_HISTORY) hist.shift();
      state.systemTimingHistory.set(action.label, hist);
      return state;
    }
    case "frame-end":
      state.latestFrame = action.frame;
      state.latestDt = action.dt;
      state.latestFrameMs = action.durationMs;
      state.fps = action.fps;
      return state;
  }
}
