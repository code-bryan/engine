import { getComponentRegistry, type ComponentRegistryEntry, type Entity, type World, type WorldDebugEvent } from "@engine/ecs-core";
import type { Physics, PhysicsDebugEvent } from "@engine/physics";
import { sprites, transforms, type EngineApplication } from "@engine/renderer";
import { Container, Graphics, Text, TextureSource, type SCALE_MODE } from "pixi.js";
import { createRoot } from "react-dom/client";
import { createBuiltinInspectorComponents, createStoreInspector, applyInspectorEdit } from "./inspectors";
import { getEntityEditorBounds, hitEditorGizmo, type GizmoHit } from "./runtimes/gizmo";
import { resolveGridOptions } from "./runtimes/grid";
import { renderPhysicsOverlay } from "./runtimes/overlay";
import { captureRegistrySnapshot, captureWorldSnapshot, restoreRegistrySnapshot, restoreWorldSnapshot } from "./runtimes/snapshots";
import { ensureDebuggerStyles } from "./runtimes/styles";
import type {
  DebugEditor,
  DebugGridOptions,
  DebugInspectorComponent,
  DebugState,
  DebugTrackedStore,
  DebugWorldSnapshot,
  DebuggerWorld,
  LogCategory,
  LogEntry,
  RuntimeDebuggerOptions,
} from "./shared/types";
import { ALL_LOG_CATEGORIES } from "./shared/types";
import type { ContentTreeNode } from "./shared/types";
import { renderDebuggerUi, type DebuggerUiActions } from "./ui/view-models";

export type {
  ContentTreeNode,
  DebugEditorField,
  DebugEditorSection,
  DebugInspectorComponent,
  DebugPlayback,
  DebugStatusPanel,
  DebugStoreInspectorOptions,
  DebugTrackedStore,
  DebugGridOptions,
  RuntimeDebuggerOptions,
  DebugEditor,
  DebugWorldSnapshot,
  DebuggerWorld,
} from "./shared/types";
export type { WorldEntityBase, WorldData } from "./shared/world";
export { createStoreInspector, captureWorldSnapshot, restoreWorldSnapshot };

const CAMERA_ZOOM_SENSITIVITY_STORAGE_KEY = "engine.debugger.cameraZoomSensitivity";
const DEFAULT_CAMERA_ZOOM_SENSITIVITY = 2.5;
const MIN_CAMERA_ZOOM_SENSITIVITY = 1;
const MAX_CAMERA_ZOOM_SENSITIVITY = 8;

export function attachRuntimeDebugger<TWorld extends DebuggerWorld>(
  world: TWorld,
  engine: EngineApplication,
  options: RuntimeDebuggerOptions<TWorld> = {},
): DebugEditor<TWorld> {
  ensureDebuggerStyles();

  const shell = document.querySelector(".app-shell");
  if (!(shell instanceof HTMLElement)) throw new Error("app shell not found");
  shell.classList.add("app-shell--debug");

  const viewport = document.querySelector(".game-frame");
  if (!(viewport instanceof HTMLElement)) throw new Error("game frame not found");

  const state: DebugState = {
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
    cameraZoomSensitivity: loadCameraZoomSensitivity(),
    lockTarget: undefined,
    toolMode: "select",
    entityQuery: "",
    inspectorQuery: "",
    openDropdown: undefined,
    contentDrawerOpen: options.initialContentDrawerOpen ?? false,
    openWorlds: (() => {
      const seed = options.initialOpenWorlds ?? (options.activeWorld ? [options.activeWorld] : []);
      return options.activeWorld && !seed.includes(options.activeWorld) ? [...seed, options.activeWorld] : seed;
    })(),
    openDocs: [],
    activeDoc: null,
    sceneSelected: false,
    snapGrid: true,
    snapGridSize: 16,
    snapRotate: true,
    snapRotateDeg: 15,
  };

  const registry = getComponentRegistry();
  const explicitComponentIds = new Set((options.components ?? []).map((c) => c.id));

  const autoInspectors: DebugInspectorComponent<TWorld>[] = registry
    .filter((e) => !explicitComponentIds.has(e.id))
    .map((e) => ({
      id: e.id,
      title: e.label,
      fields(_world: TWorld, entity: Entity) {
        const value = e.store.get(entity);
        if (value === undefined) return [];
        return [{ label: "Value", value: stableSerialize(value) }];
      },
    }));

  const componentInspectors = [
    ...createBuiltinInspectorComponents(options.getEntityTitle),
    ...autoInspectors,
    ...(options.components ?? []),
    ...(options.sections ?? []).map((section, index) => ({
      id: `legacy-section-${index}`,
      title: section.title,
      fields(world: TWorld, entity: Entity) {
        const fields = typeof section.fields === "function" ? section.fields(world, entity) : section.fields;
        return fields;
      },
    })),
  ];
  const componentInspectorMap = new Map(componentInspectors.map((component) => [component.id, component]));

  const trackedStoreMap = new Map<string, DebugTrackedStore>();
  for (const e of registry) trackedStoreMap.set(e.label, { label: e.label, store: e.store });
  for (const s of options.trackedStores ?? []) trackedStoreMap.set(s.label, s);
  const trackedStores = Array.from(trackedStoreMap.values());
  const gridOptions = resolveGridOptions(options.grid);
  state.snapGridSize = gridOptions.snapSize;
  const storeSnapshots = new Map<string, string>();
  const labels = new Map<number, Text>();

  const layout = document.createElement("div");
  layout.className = "debugger-root";
  viewport.appendChild(layout);
  const reactRoot = createRoot(layout);

  const overlay = new Graphics();
  overlay.eventMode = "none";
  engine.app.stage.addChild(overlay);

  // store original game resolution and background to restore on destroy
  const gameW = engine.app.renderer.width;
  const gameH = engine.app.renderer.height;
  const origBg = engine.app.renderer.background.color;
  engine.app.renderer.background.color = 0x141414;

  // pixel-perfect filtering for zoom — collect unique texture sources and set nearest
  const origScaleModes = new Map<TextureSource, SCALE_MODE>();
  const setNearestFiltering = () => {
    for (const [, spriteRef] of sprites) {
      const src = spriteRef.sprite.texture.source;
      if (!origScaleModes.has(src)) origScaleModes.set(src, src.scaleMode);
      src.scaleMode = "nearest";
    }
  };
  setNearestFiltering();

  let refresh = () => {};

  const getEditorViewportRect = () => {
    const stage = document.querySelector(".debugger-stage");
    if (stage instanceof HTMLElement) return stage.getBoundingClientRect();
    return viewport.getBoundingClientRect();
  };

  const centerCamera = () => {
    const rect = getEditorViewportRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    state.camera.zoom = Math.min(w / gameW, h / gameH) * 0.92;
    state.camera.x = rect.left + (w - gameW * state.camera.zoom) / 2;
    state.camera.y = rect.top + (h - gameH * state.camera.zoom) / 2;
  };

  const resizeRendererToViewport = () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w > 0 && h > 0) {
      engine.app.renderer.resize(w, h);
      centerCamera();
      refresh();
    }
  };
  resizeRendererToViewport();
  const resizeObserver = new ResizeObserver(resizeRendererToViewport);
  resizeObserver.observe(viewport);

  queueMicrotask(() => options.playback?.onPause?.());

  refresh = () => {
    if (state.lockTarget !== undefined) {
      const t = transforms.get(state.lockTarget);
      if (t) {
        const rect = getEditorViewportRect();
        state.camera.x = rect.left + rect.width / 2 - t.x * state.camera.zoom;
        state.camera.y = rect.top + rect.height / 2 - t.y * state.camera.zoom;
      }
    }
    applyCameraToStage(engine.app.stage, state.camera);
    recordStoreDiffs(world, trackedStores, storeSnapshots, state);
    renderPhysicsOverlay(
      world,
      overlay,
      labels,
      state.selectedEntity,
      options.getEntityTitle,
      state,
      gridOptions,
      engine.app.renderer.width,
      engine.app.renderer.height,
      gameW,
      gameH,
    );
    renderDebuggerUi(reactRoot, world, state, componentInspectors, options, {
        toggleDebugMenu() {
          state.openDropdown = state.openDropdown === "debug" ? undefined : "debug";
          refresh();
        },
        closeMenus() {
          if (state.openDropdown === undefined) return;
          state.openDropdown = undefined;
          refresh();
        },
        toggleGrid() {
          state.showGrid = !state.showGrid;
          refresh();
        },
        togglePhysics() {
          state.showPhysics = !state.showPhysics;
          refresh();
        },
        toggleLabels() {
          state.showLabels = !state.showLabels;
          refresh();
        },
        toggleSprites() {
          state.showSprites = !state.showSprites;
          refresh();
        },
        toggleCameraLock() {
          state.lockTarget = state.lockTarget !== undefined ? undefined : state.selectedEntity;
          refresh();
        },
        setToolMode(mode) {
          state.toolMode = mode;
          refresh();
        },
        playback(action) {
          if (action === "play") options.playback?.onPlay?.();
          if (action === "pause") options.playback?.onPause?.();
          if (action === "step") options.playback?.onStep?.();
          if (action === "stop") options.playback?.onStop?.();
          refresh();
        },
        zoom(action) {
          applyZoomAction(action, engine, state, centerCamera, getEditorViewportRect);
          refresh();
        },
        setZoomSensitivity(value) {
          state.cameraZoomSensitivity = clamp(value, MIN_CAMERA_ZOOM_SENSITIVITY, MAX_CAMERA_ZOOM_SENSITIVITY);
          saveCameraZoomSensitivity(state.cameraZoomSensitivity);
          refresh();
        },
        setEntityQuery(value) {
          state.entityQuery = value;
          refresh();
        },
        setInspectorQuery(value) {
          state.inspectorQuery = value;
          refresh();
        },
        selectEntity(entity) {
          state.selectedEntity = entity;
          state.sceneSelected = false;
          refresh();
        },
        selectScene() {
          state.sceneSelected = true;
          state.selectedEntity = undefined;
          refresh();
        },
        addSystem(name) {
          options.onAddSystem?.(name);
        },
        removeSystem(name) {
          options.onRemoveSystem?.(name);
        },
        toggleComponentCollapse(id) {
          if (state.collapsedComponents.has(id)) state.collapsedComponents.delete(id);
          else state.collapsedComponents.add(id);
          refresh();
        },
        editInspector(entity, componentId, key, value) {
          applyInspectorEdit(world, componentInspectorMap, entity, componentId, key, value);
          options.onWorldEdited?.(world);
          refresh();
        },
        openLevel() {
          options.onOpenLevel?.();
        },
        toggleContentDrawer() {
          state.contentDrawerOpen = !state.contentDrawerOpen;
          options.onContentDrawerToggled?.(state.contentDrawerOpen);
          refresh();
        },
        loadWorld(name) {
          options.onLoadWorld?.(name);
        },
        saveSnapshot() {
          state.snapshots.unshift(captureRegistrySnapshot(world, registry));
          if (state.snapshots.length > 5) state.snapshots.length = 5;
          refresh();
        },
        restoreSnapshot(index) {
          const snap = state.snapshots[index];
          if (snap) {
            restoreRegistrySnapshot(world, snap, registry);
            engine.tick(0);
          }
          refresh();
        },
        toggleSystem(index) {
          const entries = world.getSystemEntries();
          world.setSystemEnabled(index, !entries[index]?.enabled);
          refresh();
        },
        toggleLogFilter(cat) {
          const category = cat as LogCategory;
          if (state.logFilter.has(category)) state.logFilter.delete(category);
          else state.logFilter.add(category);
          refresh();
        },
        toggleLogPause() {
          state.logPaused = !state.logPaused;
          refresh();
        },
        toggleGridSnap() {
          state.snapGrid = !state.snapGrid;
          refresh();
        },
        setGridSnapSize(value) {
          if (Number.isFinite(value)) state.snapGridSize = clamp(Math.round(value), 1, 512);
          refresh();
        },
        calcGridSnapSize() {
          if (state.selectedEntity === undefined) return;
          const bounds = getEntityEditorBounds(world, state.selectedEntity);
          if (bounds) state.snapGridSize = clamp(Math.round(Math.max(bounds.width, bounds.height)), 1, 512);
          refresh();
        },
        toggleRotationSnap() {
          state.snapRotate = !state.snapRotate;
          refresh();
        },
        setRotationSnapDeg(value) {
          if (Number.isFinite(value)) state.snapRotateDeg = clamp(Math.round(value), 1, 180);
          refresh();
        },
        openDoc(path, kind) {
          if (!state.openDocs.some((doc) => doc.path === path)) state.openDocs = [...state.openDocs, { path, kind }];
          state.activeDoc = path;
          refresh();
        },
        closeDoc(path) {
          const index = state.openDocs.findIndex((doc) => doc.path === path);
          state.openDocs = state.openDocs.filter((doc) => doc.path !== path);
          if (state.activeDoc === path) {
            state.activeDoc = state.openDocs[index]?.path ?? state.openDocs[index - 1]?.path ?? null;
          }
          refresh();
        },
        selectDoc(path) {
          state.activeDoc = path;
          refresh();
        },
        openWorld(path) {
          if (!state.openWorlds.includes(path)) {
            state.openWorlds = [...state.openWorlds, path];
            options.onOpenWorldsChanged?.(state.openWorlds);
          }
          if (path !== options.activeWorld) {
            options.onLoadWorld?.(path);
            return;
          }
          state.activeDoc = null;
          refresh();
        },
        selectWorld(path) {
          if (path !== options.activeWorld) {
            options.onLoadWorld?.(path);
            return;
          }
          state.activeDoc = null;
          refresh();
        },
        closeWorld(path) {
          const index = state.openWorlds.indexOf(path);
          state.openWorlds = state.openWorlds.filter((entry) => entry !== path);
          options.onOpenWorldsChanged?.(state.openWorlds);
          if (path === options.activeWorld) {
            const fallback = state.openWorlds[index] ?? state.openWorlds[index - 1];
            if (fallback) { options.onLoadWorld?.(fallback); return; }
          }
          refresh();
        },
      }, ALL_LOG_CATEGORIES);
  };

  const unsubscribers: Array<() => void> = [];

  unsubscribers.push(world.onDebugEvent((event) => {
    switch (event.type) {
      case "frame:start":
        state.latestFrame = event.frame;
        state.latestDt = event.dt;
        state.systemMetrics = [];
        break;
      case "system:run": {
        state.systemMetrics.push({ label: event.label, durationMs: event.durationMs });
        const hist = state.systemTimingHistory.get(event.label) ?? [];
        hist.push(event.durationMs);
        if (hist.length > 60) hist.shift();
        state.systemTimingHistory.set(event.label, hist);
        break;
      }
      case "frame:end":
        state.latestFrame = event.frame;
        state.latestDt = event.dt;
        state.latestFrameMs = event.durationMs;
        state.fps = event.dt > 0 ? 1 / event.dt : 0;
        refresh();
        break;
      default:
        pushLog(state, formatWorldEvent(world, event, options.getEntityTitle));
        break;
    }
  }));

  unsubscribers.push(world.physics.onDebugEvent((event) => {
    pushLog(state, formatPhysicsEvent(world, event, options.getEntityTitle));
  }));

  let drag: { startX: number; startY: number; camX: number; camY: number } | null = null;
  let entityDrag: { entity: Entity; offsetX: number; offsetY: number } | null = null;
  let gizmoDrag: {
    hit: GizmoHit;
    startWorld: { x: number; y: number };
    startPosition: { x: number; y: number };
    startRotation: number;
    startScale: { x: number; y: number };
  } | null = null;
  let didDrag = false;
  let suppressCanvasClick = false;

  const isCameraPanGesture = (event: PointerEvent) => (
    event.button === 1
    || (event.button === 0 && (event.altKey || event.metaKey))
  );

  const handleCanvasClick = (event: MouseEvent) => {
    if (suppressCanvasClick) {
      suppressCanvasClick = false;
      return;
    }
    const canvasPt = toCanvasPoint(engine.app.canvas, event.clientX, event.clientY);
    const stage = engine.app.stage;
    const worldPt = {
      x: (canvasPt.x - stage.position.x) / stage.scale.x,
      y: (canvasPt.y - stage.position.y) / stage.scale.y,
    };
    state.selectedEntity = world.physics.pickEntityAt(worldPt);
    refresh();
  };

  const handleCanvasPointerDown = (event: PointerEvent) => {
    if (isCameraPanGesture(event)) {
      event.preventDefault();
      drag = { startX: event.clientX, startY: event.clientY, camX: state.camera.x, camY: state.camera.y };
      didDrag = false;
      engine.app.canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button === 0) {
      const worldPt = toWorldPoint(engine.app.canvas, engine.app.stage, event.clientX, event.clientY);
      const gizmoHit = hitEditorGizmo(world, state.selectedEntity, state.toolMode, worldPt, state.camera.zoom);
      if (state.toolMode !== "select" && gizmoHit) {
        const transform = transforms.get(gizmoHit.entity);
        if (transform) {
          state.lockTarget = undefined;
          gizmoDrag = {
            hit: gizmoHit,
            startWorld: worldPt,
            startPosition: { x: transform.x, y: transform.y },
            startRotation: transform.rotation ?? 0,
            startScale: normalizeScale(transform.scale),
          };
          didDrag = false;
          suppressCanvasClick = false;
          engine.app.canvas.setPointerCapture(event.pointerId);
          refresh();
          return;
        }
      }

      const picked = world.physics.pickEntityAt(worldPt);
      if (state.toolMode === "move" && picked !== undefined) {
        const transform = transforms.get(picked);
        if (transform) {
          state.selectedEntity = picked;
          state.lockTarget = undefined;
          entityDrag = {
            entity: picked,
            offsetX: worldPt.x - transform.x,
            offsetY: worldPt.y - transform.y,
          };
          didDrag = false;
          suppressCanvasClick = false;
          engine.app.canvas.setPointerCapture(event.pointerId);
          refresh();
          return;
        }
      }
    }
  };

  const handleCanvasPointerMove = (event: PointerEvent) => {
    if (gizmoDrag) {
      const worldPt = toWorldPoint(engine.app.canvas, engine.app.stage, event.clientX, event.clientY);
      applyGizmoDrag(world, gizmoDrag, worldPt, {
        grid: state.snapGrid,
        gridSize: state.snapGridSize,
        rotate: state.snapRotate,
        rotateDeg: state.snapRotateDeg,
      });
      engine.tick(0);
      options.onWorldEdited?.(world);
      didDrag = true;
      suppressCanvasClick = true;
      refresh();
      return;
    }

    if (entityDrag) {
      const worldPt = toWorldPoint(engine.app.canvas, engine.app.stage, event.clientX, event.clientY);
      const nextX = state.snapGrid ? snapToGrid(worldPt.x - entityDrag.offsetX, state.snapGridSize) : worldPt.x - entityDrag.offsetX;
      const nextY = state.snapGrid ? snapToGrid(worldPt.y - entityDrag.offsetY, state.snapGridSize) : worldPt.y - entityDrag.offsetY;
      const transform = transforms.get(entityDrag.entity);
      if (transform) {
        transform.x = nextX;
        transform.y = nextY;
      }
      world.physics.reset(entityDrag.entity, { x: nextX, y: nextY }, { x: 0, y: 0 });
      engine.tick(0);
      options.onWorldEdited?.(world);
      didDrag = true;
      suppressCanvasClick = true;
      refresh();
      return;
    }

    if (!drag || state.lockTarget !== undefined) return;
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4) didDrag = true;
    const rect = engine.app.canvas.getBoundingClientRect();
    const cssScale = rect.width / engine.app.canvas.width;
    state.camera.x = drag.camX + (event.clientX - drag.startX) / cssScale;
    state.camera.y = drag.camY + (event.clientY - drag.startY) / cssScale;
    refresh();
  };

  const handleCanvasPointerUp = () => {
    drag = null;
    entityDrag = null;
    gizmoDrag = null;
  };

  const handleCanvasWheel = (event: WheelEvent) => {
    if (event.deltaY === 0) return;
    const target = event.target as Element;
    if (target.closest(".debugger-panel, .debugger-toolbar")) return;
    event.preventDefault();
    const rect = engine.app.canvas.getBoundingClientRect();
    const cssScale = rect.width / engine.app.canvas.width;
    const cx = (event.clientX - rect.left) / cssScale;
    const cy = (event.clientY - rect.top) / cssScale;
    const wx = (cx - state.camera.x) / state.camera.zoom;
    const wy = (cy - state.camera.y) / state.camera.zoom;
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 240 : 1);
    const speed = Math.pow(state.cameraZoomSensitivity, 1.35);
    const factor = Math.exp(-delta * 0.0015 * speed);
    state.camera.zoom = Math.max(0.1, Math.min(20, state.camera.zoom * factor));
    state.camera.x = cx - wx * state.camera.zoom;
    state.camera.y = cy - wy * state.camera.zoom;
    refresh();
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest("[data-dropdown-root]") && state.openDropdown !== undefined) {
      state.openDropdown = undefined;
      refresh();
    }
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (options.playback?.getState?.() === "playing") return;

    const target = event.target;
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || (target instanceof HTMLElement && target.isContentEditable)
    ) return;

    const key = event.key.toLowerCase();
    if (key === "q") {
      state.toolMode = "select";
      refresh();
    } else if (key === "w") {
      state.toolMode = "move";
      refresh();
    } else if (key === "e") {
      state.toolMode = "rotate";
      refresh();
    } else if (key === "r") {
      state.toolMode = "scale";
      refresh();
    } else {
      return;
    }

    event.preventDefault();
  };
  document.addEventListener("click", handleDocumentClick);
  window.addEventListener("keydown", handleWindowKeyDown);

  engine.app.canvas.addEventListener("click", handleCanvasClick);
  engine.app.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  engine.app.canvas.addEventListener("pointermove", handleCanvasPointerMove);
  engine.app.canvas.addEventListener("pointerup", handleCanvasPointerUp);
  engine.app.canvas.addEventListener("pointerleave", handleCanvasPointerUp);
  shell.addEventListener("wheel", handleCanvasWheel, { passive: false });

  refresh();

  return {
    world,
    setActiveSystems(names: string[]) {
      options.activeSystems = names;
      refresh();
    },
    setActiveWorld(name: string, opts?: { activeSystems?: string[]; contentTree?: ContentTreeNode[] }) {
      options.activeWorld = name;
      if (opts?.activeSystems) options.activeSystems = opts.activeSystems;
      if (opts?.contentTree) options.contentTree = opts.contentTree;
      state.selectedEntity = undefined;
      state.sceneSelected = false;
      state.lockTarget = undefined;
      for (const label of labels.values()) label.destroy();
      labels.clear();
      setNearestFiltering();
      centerCamera();
      refresh();
    },
    destroy() {
      overlay.destroy();
      for (const label of labels.values()) label.destroy();
      labels.clear();
      layout.remove();
      shell.classList.remove("app-shell--debug");
      resizeObserver.disconnect();
      engine.app.renderer.resize(gameW, gameH);
      engine.app.renderer.background.color = origBg;
      for (const [src, mode] of origScaleModes) src.scaleMode = mode;
      engine.app.stage.scale.set(1, 1);
      engine.app.stage.position.set(0, 0);
      engine.app.canvas.removeEventListener("click", handleCanvasClick);
      engine.app.canvas.removeEventListener("pointerdown", handleCanvasPointerDown);
      engine.app.canvas.removeEventListener("pointermove", handleCanvasPointerMove);
      engine.app.canvas.removeEventListener("pointerup", handleCanvasPointerUp);
      engine.app.canvas.removeEventListener("pointerleave", handleCanvasPointerUp);
      shell.removeEventListener("wheel", handleCanvasWheel);
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("keydown", handleWindowKeyDown);
      reactRoot.unmount();
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}

function recordStoreDiffs<TWorld extends DebuggerWorld>(
  world: TWorld,
  trackedStores: DebugTrackedStore[],
  snapshots: Map<string, string>,
  state: DebugState,
) {
  const next = new Set<string>();

  for (const tracked of trackedStores) {
    for (const [entity, value] of tracked.store) {
      const key = `${tracked.label}:${entity}`;
      const snapshot = stableSerialize(value);
      next.add(key);

      if (snapshots.get(key) !== snapshot) {
        if (snapshots.has(key)) pushLog(state, { cat: "store", text: `frame ${world.getFrame()} ${tracked.label}[${entity}] ${snapshot}` });
        snapshots.set(key, snapshot);
      }
    }
  }

  for (const key of Array.from(snapshots.keys())) {
    if (next.has(key)) continue;
    snapshots.delete(key);
  }
}

function formatWorldEvent<TWorld extends DebuggerWorld>(
  world: TWorld,
  event: WorldDebugEvent,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): Omit<LogEntry, "count"> | null {
  switch (event.type) {
    case "entity:spawn":
      return { cat: "entity", text: `frame ${event.frame} spawn ${entityLabel(world, event.entity, getEntityTitle)}` };
    case "entity:destroy":
      return { cat: "entity", text: `frame ${event.frame} destroy ${entityLabel(world, event.entity, getEntityTitle)}` };
    case "tag:add":
      return { cat: "tag", text: `frame ${event.frame} tag+ ${entityLabel(world, event.entity, getEntityTitle)} ${event.tag}` };
    case "tag:remove":
      return { cat: "tag", text: `frame ${event.frame} tag- ${entityLabel(world, event.entity, getEntityTitle)} ${event.tag}` };
    case "system:add":
      return { cat: "system", text: `frame ${event.frame} system ${event.index} ${event.label}` };
    default:
      return null;
  }
}

function formatPhysicsEvent<TWorld extends DebuggerWorld>(
  world: TWorld,
  event: PhysicsDebugEvent,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): Omit<LogEntry, "count"> {
  switch (event.type) {
    case "body:set":
      return { cat: "physics", text: `body set ${entityLabel(world, event.entity, getEntityTitle)} ${event.kind} ${event.width}x${event.height} @ ${event.x},${event.y}` };
    case "body:reset":
      return { cat: "physics", text: `body reset ${entityLabel(world, event.entity, getEntityTitle)} @ ${event.x},${event.y}` };
    case "body:angle":
      return { cat: "physics", text: `body angle ${entityLabel(world, event.entity, getEntityTitle)} ${event.angle.toFixed(2)}` };
    case "body:velocity":
      return { cat: "physics", text: `velocity ${entityLabel(world, event.entity, getEntityTitle)} ${event.velocity.x.toFixed(2)},${event.velocity.y.toFixed(2)}` };
    case "collision:start":
      return { cat: "collision", text: `collision start ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}` };
    case "collision:end":
      return { cat: "collision", text: `collision end ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}` };
  }
}

function pushLog(state: DebugState, entry: Omit<LogEntry, "count"> | null) {
  if (!entry || state.logPaused) return;
  const head = state.eventLog[0];
  if (head && head.cat === entry.cat && head.text === entry.text) {
    head.count++;
    return;
  }
  state.eventLog.unshift({ ...entry, count: 1 });
  if (state.eventLog.length > 80) state.eventLog.length = 80;
}

function entityTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `${firstTag}_${entity}`;
}

function entityListTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `#${entity} ${firstTag}`;
}

function entityLabel<TWorld extends DebuggerWorld>(
  world: TWorld,
  entity: Entity,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
) {
  return getEntityTitle?.(world, entity) ?? entityTitle(world, entity);
}

function applyZoomAction(
  action: "zoom-in" | "zoom-out" | "zoom-100" | "zoom-fit" | "camera-reset",
  engine: EngineApplication,
  state: DebugState,
  centerCamera: () => void,
  getViewportRect: () => DOMRect,
) {
  if (action === "zoom-in" || action === "zoom-out" || action === "zoom-100") {
    const rect = getViewportRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const wx = (cx - state.camera.x) / state.camera.zoom;
    const wy = (cy - state.camera.y) / state.camera.zoom;
    const factor = action === "zoom-in" ? 1.25 : action === "zoom-out" ? 1 / 1.25 : null;
    state.camera.zoom = factor !== null
      ? Math.max(0.1, Math.min(20, state.camera.zoom * factor))
      : 1;
    state.camera.x = cx - wx * state.camera.zoom;
    state.camera.y = cy - wy * state.camera.zoom;
    return;
  }

  if (action === "zoom-fit") {
    state.lockTarget = undefined;
    centerCamera();
    return;
  }

  state.camera.zoom = 1;
  state.lockTarget = undefined;
  centerCamera();
}

function applyCameraToStage(
  stage: Container,
  camera: { x: number; y: number; zoom: number },
) {
  stage.scale.set(camera.zoom);
  stage.position.set(camera.x, camera.y);
}

function loadCameraZoomSensitivity() {
  if (typeof localStorage === "undefined") return DEFAULT_CAMERA_ZOOM_SENSITIVITY;
  const raw = localStorage.getItem(CAMERA_ZOOM_SENSITIVITY_STORAGE_KEY);
  if (raw === null) return DEFAULT_CAMERA_ZOOM_SENSITIVITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? clamp(parsed, MIN_CAMERA_ZOOM_SENSITIVITY, MAX_CAMERA_ZOOM_SENSITIVITY)
    : DEFAULT_CAMERA_ZOOM_SENSITIVITY;
}

function saveCameraZoomSensitivity(value: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CAMERA_ZOOM_SENSITIVITY_STORAGE_KEY, String(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function toWorldPoint(canvas: HTMLCanvasElement, stage: Container, clientX: number, clientY: number) {
  const canvasPt = toCanvasPoint(canvas, clientX, clientY);
  return {
    x: (canvasPt.x - stage.position.x) / stage.scale.x,
    y: (canvasPt.y - stage.position.y) / stage.scale.y,
  };
}

function snapToGrid(value: number, step: number) {
  if (step <= 1) return value;
  return Math.round(value / step) * step;
}

function normalizeScale(scale?: number | { x: number; y: number }) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}

function applyGizmoDrag<TWorld extends DebuggerWorld>(
  world: TWorld,
  drag: {
    hit: GizmoHit;
    startWorld: { x: number; y: number };
    startPosition: { x: number; y: number };
    startRotation: number;
    startScale: { x: number; y: number };
  },
  worldPt: { x: number; y: number },
  snap: { grid: boolean; gridSize: number; rotate: boolean; rotateDeg: number },
) {
  const transform = transforms.get(drag.hit.entity);
  if (!transform) return;

  if (drag.hit.kind === "move") {
    const rawX = drag.startPosition.x + (worldPt.x - drag.startWorld.x);
    const rawY = drag.startPosition.y + (worldPt.y - drag.startWorld.y);
    const nextX = snap.grid ? snapToGrid(rawX, snap.gridSize) : rawX;
    const nextY = snap.grid ? snapToGrid(rawY, snap.gridSize) : rawY;
    transform.x = nextX;
    transform.y = nextY;
    world.physics.reset(drag.hit.entity, { x: nextX, y: nextY }, { x: 0, y: 0 });
    return;
  }

  if (drag.hit.kind === "rotate") {
    const bounds = getEntityEditorBounds(world, drag.hit.entity);
    if (!bounds) return;
    const startAngle = Math.atan2(drag.startWorld.y - bounds.pivotY, drag.startWorld.x - bounds.pivotX);
    const nextAngle = Math.atan2(worldPt.y - bounds.pivotY, worldPt.x - bounds.pivotX);
    const rawRotation = drag.startRotation + (nextAngle - startAngle);
    const rotation = snap.rotate ? snapRotation(rawRotation, snap.rotateDeg) : rawRotation;
    transform.rotation = rotation;
    world.physics.setAngle(drag.hit.entity, rotation);
    return;
  }

  const { bounds, handle } = drag.hit;
  const px = bounds.pivotX;
  const py = bounds.pivotY;
  const startDx = drag.startWorld.x - px;
  const startDy = drag.startWorld.y - py;
  const nextDx = worldPt.x - px;
  const nextDy = worldPt.y - py;
  const minScale = 0.1;

  let nextScaleX = drag.startScale.x;
  let nextScaleY = drag.startScale.y;

  if (handle === "uniform") {
    const startDist = Math.hypot(startDx, startDy);
    const nextDist = Math.hypot(nextDx, nextDy);
    const factor = startDist < 0.001 ? 1 : nextDist / startDist;
    nextScaleX = Math.max(minScale, drag.startScale.x * factor);
    nextScaleY = Math.max(minScale, drag.startScale.y * factor);
  } else if (handle === "x") {
    if (Math.abs(startDx) >= 0.001) nextScaleX = Math.max(minScale, drag.startScale.x * (nextDx / startDx));
  } else {
    if (Math.abs(startDy) >= 0.001) nextScaleY = Math.max(minScale, drag.startScale.y * (nextDy / startDy));
  }

  transform.scale = {
    x: snapScale(nextScaleX),
    y: snapScale(nextScaleY),
  };
}

function snapScale(value: number) {
  return Math.round(value * 20) / 20;
}

function snapRotation(angle: number, degrees: number) {
  const step = (Math.max(1, degrees) * Math.PI) / 180;
  return Math.round(angle / step) * step;
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (value instanceof Set) return JSON.stringify(Array.from(value).sort());
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => stableNormalize(item)));
  return JSON.stringify(stableNormalize(value));
}

function stableNormalize(value: unknown): unknown {
  if (value instanceof Set) return Array.from(value).sort();
  if (Array.isArray(value)) return value.map((item) => stableNormalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableNormalize(item)]),
    );
  }
  return value;
}
