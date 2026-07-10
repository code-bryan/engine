import { getComponentRegistry, type Entity } from "@engine/ecs-core";
import { transforms, type EngineApplication } from "@engine/renderer";
import { createRoot } from "react-dom/client";
import {
  applyInspectorEdit,
  createBuiltinInspectorComponents,
} from "../features/inspector/cards";
import { getEntityEditorBounds, hitEditorGizmo, type GizmoHit } from "../features/viewport/gizmo";
import { applyGizmoDrag, snapToGrid } from "../features/viewport/gizmo-drag";
import { resolveGridOptions } from "../features/viewport/grid";
import { buildOverlay } from "../features/viewport/overlay";
import { centerCamera as fitCamera, wheelZoomCamera, zoomActionCamera } from "../features/viewport/camera";
import { formatPhysicsEvent, formatWorldEvent, stableSerialize } from "../features/log/format";
import { captureRegistrySnapshot, restoreRegistrySnapshot } from "../features/snapshots/snapshots";
import { installKeyboard } from "./keyboard";
import { createPixiViewportRenderer } from "./viewport-renderer/pixi";
import { createStore } from "../state/store";
import type { DebugState } from "../state/types";
import { renderEditor, type EditorUiActions } from "../shell/view-model";
import { ensureEditorStyles } from "../styles";
import { ALL_LOG_CATEGORIES } from "../shared/types";
import type {
  ContentBookmark,
  ContentTreeNode,
  DebugEditor,
  DebugInspectorComponent,
  DebugTrackedStore,
  DebuggerWorld,
  LogCategory,
  RuntimeDebuggerOptions,
} from "../shared/types";

const CAMERA_ZOOM_SENSITIVITY_STORAGE_KEY = "engine.debugger.cameraZoomSensitivity";
const DEFAULT_CAMERA_ZOOM_SENSITIVITY = 2.5;
const MIN_CAMERA_ZOOM_SENSITIVITY = 1;
const MAX_CAMERA_ZOOM_SENSITIVITY = 8;

export function attachEditor<TWorld extends DebuggerWorld>(
  world: TWorld,
  engine: EngineApplication,
  options: RuntimeDebuggerOptions<TWorld> = {},
): DebugEditor<TWorld> {
  ensureEditorStyles();

  const shell = document.querySelector(".app-shell");
  if (!(shell instanceof HTMLElement)) throw new Error("app shell not found");
  shell.classList.add("app-shell--debug");

  const viewport = document.querySelector(".game-frame");
  if (!(viewport instanceof HTMLElement)) throw new Error("game frame not found");

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
    ...createBuiltinInspectorComponents(options.getEntityTitle, options.getEntityPrefab),
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
  const storeSnapshots = new Map<string, string>();

  const initialState: DebugState = {
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
    snapGridSize: gridOptions.snapSize,
    snapRotate: true,
    snapRotateDeg: 15,
    worldDirty: false,
    toasts: [],
    toastSeq: 0,
  };

  const store = createStore(initialState);
  const getState = () => store.getState();

  const worldName = () => (options.activeWorld ?? "").split("/").filter(Boolean).at(-1) ?? "";

  // An in-editor change (gizmo drag, inspector edit) marks the active world dirty
  // in memory — no disk write. The world is persisted only on an explicit save.
  const markWorldDirty = () => {
    if (!getState().worldDirty) store.dispatch({ type: "set-world-dirty", dirty: true });
  };

  // Explicit save (⌘/Ctrl+S, File ▸ Save). No-op unless the active world view has
  // unsaved changes. Persists via the host, clears dirty, confirms with a toast
  // (coalesced with the fetch interceptor's toast for the same POST).
  const saveActiveWorld = () => {
    if (getState().activeDoc !== null || !getState().worldDirty) return;
    options.onSaveWorld?.(world);
    store.dispatch({ type: "set-world-dirty", dirty: false });
    store.dispatch({ type: "add-toast", toast: { kind: "success", title: "Saved", description: worldName() || undefined, coalesceKey: `file:${options.activeWorld ?? ""}` } });
    render();
  };

  const layout = document.createElement("div");
  layout.className = "debugger-root";
  viewport.appendChild(layout);
  const reactRoot = createRoot(layout);

  const renderer = createPixiViewportRenderer(engine, viewport);
  const gameW = engine.app.renderer.width;
  const gameH = engine.app.renderer.height;
  renderer.setBackground(0x141414);
  renderer.setPixelFiltering();

  let render: () => void = () => {};

  const centerCamera = () => {
    const camera = fitCamera(renderer.getViewportRect(), gameW, gameH);
    store.dispatch({ type: "set-camera", camera });
  };

  const resizeRendererToViewport = () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w > 0 && h > 0) {
      renderer.resize(w, h);
      centerCamera();
      render();
    }
  };
  resizeRendererToViewport();
  const resizeObserver = new ResizeObserver(resizeRendererToViewport);
  resizeObserver.observe(viewport);

  const actions: EditorUiActions = {
    toggleDebugMenu() { store.dispatch({ type: "toggle-debug-menu" }); render(); },
    closeMenus() { store.dispatch({ type: "close-menus" }); render(); },
    toggleGrid() { store.dispatch({ type: "toggle-grid" }); render(); },
    togglePhysics() { store.dispatch({ type: "toggle-physics" }); render(); },
    toggleLabels() { store.dispatch({ type: "toggle-labels" }); render(); },
    toggleSprites() { store.dispatch({ type: "toggle-sprites" }); render(); },
    toggleCameraLock() {
      const s = getState();
      store.dispatch({ type: "set-lock", target: s.lockTarget !== undefined ? undefined : s.selectedEntity });
      render();
    },
    setToolMode(mode) { store.dispatch({ type: "set-tool", mode }); render(); },
    playback(action) {
      if (action === "play") options.playback?.onPlay?.();
      if (action === "pause") options.playback?.onPause?.();
      if (action === "step") options.playback?.onStep?.();
      if (action === "stop") options.playback?.onStop?.();
      render();
    },
    zoom(action) {
      if (action === "zoom-in" || action === "zoom-out" || action === "zoom-100") {
        store.dispatch({ type: "set-camera", camera: zoomActionCamera(action, getState().camera, renderer.getViewportRect()) });
      } else {
        store.dispatch({ type: "set-lock", target: undefined });
        centerCamera();
      }
      render();
    },
    setZoomSensitivity(value) {
      store.dispatch({ type: "set-zoom-sensitivity", value });
      saveCameraZoomSensitivity(getState().cameraZoomSensitivity);
      render();
    },
    setEntityQuery(value) { store.dispatch({ type: "set-entity-query", value }); render(); },
    setInspectorQuery(value) { store.dispatch({ type: "set-inspector-query", value }); render(); },
    selectEntity(entity) { store.dispatch({ type: "select-entity", entity }); render(); },
    selectScene() { store.dispatch({ type: "select-scene" }); render(); },
    addSystem(name) { options.onAddSystem?.(name); markWorldDirty(); render(); },
    removeSystem(name) { options.onRemoveSystem?.(name); markWorldDirty(); render(); },
    openProject(path) { options.onOpenProject?.(path); },
    createProject(path) { options.onCreateProject?.(path); },
    closeProject() { options.onCloseProject?.(); },
    browseProject(mode) { return options.onBrowseProject?.(mode) ?? Promise.resolve(null); },
    dismissToast(id) { store.dispatch({ type: "dismiss-toast", id }); render(); },
    save() { saveActiveWorld(); },
    toggleComponentCollapse(id) { store.dispatch({ type: "toggle-component-collapse", id }); render(); },
    editInspector(entity, componentId, key, value) {
      applyInspectorEdit(world, componentInspectorMap, entity, componentId, key, value);
      // A transform edit must be pushed into the physics body too, otherwise the
      // next tick overwrites the transform back from the (stale) body. Then tick
      // once so the render system repositions the sprite for the new values.
      if (componentId === "transform") {
        const transform = transforms.get(entity);
        if (transform) {
          world.physics.reset(entity, { x: transform.position.x, y: transform.position.y }, { x: 0, y: 0 });
          world.physics.setAngle(entity, transform.rotation);
        }
      }
      engine.tick(0);
      markWorldDirty();
      render();
    },
    openLevel() { options.onOpenLevel?.(); },
    toggleContentDrawer() {
      const open = !getState().contentDrawerOpen;
      store.dispatch({ type: "set-content-drawer", open });
      options.onContentDrawerToggled?.(open);
      render();
    },
    loadWorld(name) { options.onLoadWorld?.(name); },
    saveSnapshot() {
      store.dispatch({ type: "add-snapshot", snapshot: captureRegistrySnapshot(world, registry) });
      render();
    },
    restoreSnapshot(index) {
      const snap = getState().snapshots[index];
      if (snap) {
        restoreRegistrySnapshot(world, snap, registry);
        engine.tick(0);
      }
      render();
    },
    toggleSystem(index) {
      const entries = world.getSystemEntries();
      world.setSystemEnabled(index, !entries[index]?.enabled);
      render();
    },
    toggleLogFilter(cat) { store.dispatch({ type: "toggle-log-filter", cat: cat as LogCategory }); render(); },
    toggleLogPause() { store.dispatch({ type: "toggle-log-pause" }); render(); },
    toggleGridSnap() { store.dispatch({ type: "toggle-grid-snap" }); render(); },
    setGridSnapSize(value) { store.dispatch({ type: "set-grid-snap-size", value }); render(); },
    calcGridSnapSize() {
      const s = getState();
      if (s.selectedEntity === undefined) return;
      const bounds = getEntityEditorBounds(world, s.selectedEntity);
      // Empty entities have 0×0 bounds; fall back to the current grid size.
      const size = bounds ? Math.max(bounds.width, bounds.height) : 0;
      if (size > 0) store.dispatch({ type: "set-grid-snap-size", value: size });
      render();
    },
    toggleRotationSnap() { store.dispatch({ type: "toggle-rotation-snap" }); render(); },
    setRotationSnapDeg(value) { store.dispatch({ type: "set-rotation-snap-deg", value }); render(); },
    openDoc(path, kind) { store.dispatch({ type: "open-doc", path, kind }); render(); },
    closeDoc(path) { store.dispatch({ type: "close-doc", path }); render(); },
    selectDoc(path) { store.dispatch({ type: "select-doc", path }); render(); },
    openWorld(path) {
      if (!getState().openWorlds.includes(path)) {
        store.dispatch({ type: "add-open-world", path });
        options.onOpenWorldsChanged?.(getState().openWorlds);
      }
      if (path !== options.activeWorld) {
        options.onLoadWorld?.(path);
        return;
      }
      store.dispatch({ type: "set-active-doc", value: null });
      render();
    },
    selectWorld(path) {
      if (path !== options.activeWorld) {
        options.onLoadWorld?.(path);
        return;
      }
      store.dispatch({ type: "set-active-doc", value: null });
      render();
    },
    closeWorld(path) {
      const before = getState().openWorlds;
      const index = before.indexOf(path);
      store.dispatch({ type: "remove-open-world", path });
      options.onOpenWorldsChanged?.(getState().openWorlds);
      if (path === options.activeWorld) {
        const fallback = before[index + 1] ?? before[index - 1];
        if (fallback && fallback !== path) { options.onLoadWorld?.(fallback); return; }
      }
      render();
    },
  };

  render = () => {
    const s = getState();
    let camera = s.camera;
    if (s.lockTarget !== undefined) {
      const t = transforms.get(s.lockTarget);
      if (t) {
        const rect = renderer.getViewportRect();
        camera = { zoom: camera.zoom, x: rect.left + rect.width / 2 - t.position.x * camera.zoom, y: rect.top + rect.height / 2 - t.position.y * camera.zoom };
        store.dispatch({ type: "set-camera", camera });
      }
    }
    renderer.applyCamera(camera);
    recordStoreDiffs();
    renderer.paintOverlay(buildOverlay(world, getState(), options.getEntityTitle, gameW, gameH, renderer.width, renderer.height));
    renderEditor(reactRoot, world, getState(), componentInspectors, options, actions, ALL_LOG_CATEGORIES);
  };

  function recordStoreDiffs() {
    const s = getState();
    const next = new Set<string>();
    for (const tracked of trackedStores) {
      for (const [entity, value] of tracked.store) {
        const key = `${tracked.label}:${entity}`;
        const snapshot = stableSerialize(value);
        next.add(key);
        if (storeSnapshots.get(key) !== snapshot) {
          if (storeSnapshots.has(key)) store.dispatch({ type: "push-log", entry: { cat: "store", text: `frame ${world.getFrame()} ${tracked.label}[${entity}] ${snapshot}` } });
          storeSnapshots.set(key, snapshot);
        }
      }
    }
    for (const key of Array.from(storeSnapshots.keys())) {
      if (next.has(key)) continue;
      storeSnapshots.delete(key);
    }
    void s;
  }

  const unsubscribers: Array<() => void> = [];

  // While the user is typing in an inspector field, the per-frame re-render below
  // would reset the controlled input to the entity's live value each frame, wiping
  // keystrokes. Skip the React refresh while a form field is focused.
  const isEditingFormField = () => {
    const el = typeof document !== "undefined" ? document.activeElement : null;
    if (!el) return false;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable;
  };

  unsubscribers.push(world.onDebugEvent((event) => {
    switch (event.type) {
      case "frame:start":
        store.dispatch({ type: "frame-start", frame: event.frame, dt: event.dt });
        break;
      case "system:run":
        store.dispatch({ type: "system-run", label: event.label, durationMs: event.durationMs });
        break;
      case "frame:end":
        store.dispatch({ type: "frame-end", frame: event.frame, dt: event.dt, durationMs: event.durationMs, fps: event.dt > 0 ? 1 / event.dt : 0 });
        if (!isEditingFormField()) render();
        break;
      default:
        store.dispatch({ type: "push-log", entry: formatWorldEvent(world, event, options.getEntityTitle) });
        break;
    }
  }));

  unsubscribers.push(world.physics.onDebugEvent((event) => {
    store.dispatch({ type: "push-log", entry: formatPhysicsEvent(world, event, options.getEntityTitle) });
  }));

  // Save toast: every project write (world defs, components, prefabs, graphs,
  // blueprint/component autosave, imports, folder creates) funnels through a POST
  // to /api/content/{file,folder}. Intercept those here so a single hook covers
  // saves triggered from anywhere (the app, or any editor feature) without
  // threading a callback through every save site.
  const nativeFetch = window.fetch;
  const boundFetch = nativeFetch.bind(window);
  const wrappedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await boundFetch(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const routeMatch = /\/api\/content\/(file|folder|rename)(\?|$)/.exec(url);
      if (routeMatch && (method === "POST" || method === "DELETE")) {
        const route = routeMatch[1];
        const isFolder = route === "folder";
        // The rename target lives in the request body, not the query string.
        let path = "";
        if (route === "rename") {
          try {
            const parsed = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
            path = typeof parsed.to === "string" ? parsed.to : "";
          } catch {}
        } else {
          path = new URL(url, window.location.origin).searchParams.get("path") ?? "";
        }
        const name = path.split("/").filter(Boolean).at(-1) ?? "";
        const title = !response.ok
          ? method === "DELETE" ? "Delete failed" : route === "rename" ? "Rename failed" : "Save failed"
          : route === "rename"
            ? "Renamed"
            : method === "DELETE"
              ? isFolder ? "Folder deleted" : "Deleted"
              : isFolder ? "Folder created" : "Saved";
        store.dispatch({
          type: "add-toast",
          toast: {
            kind: response.ok ? "success" : "error",
            title,
            description: name || undefined,
            coalesceKey: `${route}:${path}`,
          },
        });
        render();
      }
    } catch {}
    return response;
  }) as typeof window.fetch;
  window.fetch = wrappedFetch;
  unsubscribers.push(() => {
    // Only restore if nothing else re-wrapped fetch in the meantime.
    if (window.fetch === wrappedFetch) window.fetch = nativeFetch;
  });

  // --- pointer / wheel / click interaction on the game canvas ---
  let drag: { startX: number; startY: number; camX: number; camY: number } | null = null;
  let entityDrag: { entity: Entity; offsetX: number; offsetY: number } | null = null;
  let gizmoDrag: {
    hit: GizmoHit;
    startWorld: { x: number; y: number };
    startPosition: { x: number; y: number };
    startRotation: number;
    startSize: { x: number; y: number };
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
    const worldPt = renderer.screenToWorld(event.clientX, event.clientY);
    store.dispatch({ type: "select-entity", entity: world.physics.pickEntityAt(worldPt) });
    render();
  };

  const handleCanvasPointerDown = (event: PointerEvent) => {
    const s = getState();
    if (s.contentDrawerOpen) {
      store.dispatch({ type: "set-content-drawer", open: false });
      options.onContentDrawerToggled?.(false);
      render();
    }

    if (isCameraPanGesture(event)) {
      event.preventDefault();
      const camera = getState().camera;
      drag = { startX: event.clientX, startY: event.clientY, camX: camera.x, camY: camera.y };
      didDrag = false;
      renderer.canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button === 0) {
      const worldPt = renderer.screenToWorld(event.clientX, event.clientY);
      const gizmoHit = hitEditorGizmo(world, s.selectedEntity, s.toolMode, worldPt, s.camera.zoom);
      if (s.toolMode !== "select" && gizmoHit) {
        const transform = transforms.get(gizmoHit.entity);
        if (transform) {
          store.dispatch({ type: "set-lock", target: undefined });
          gizmoDrag = {
            hit: gizmoHit,
            startWorld: worldPt,
            startPosition: { x: transform.position.x, y: transform.position.y },
            startRotation: transform.rotation,
            // Effective start size in px: explicit size when set, else the current
            // (content-derived) bounds so resizing an "auto" entity makes it explicit.
            startSize: (() => {
              const effective = getEntityEditorBounds(world, gizmoHit.entity);
              return {
                x: transform.size.x !== 0 ? transform.size.x : effective?.width ?? 0,
                y: transform.size.y !== 0 ? transform.size.y : effective?.height ?? 0,
              };
            })(),
          };
          didDrag = false;
          suppressCanvasClick = false;
          renderer.canvas.setPointerCapture(event.pointerId);
          render();
          return;
        }
      }

      const picked = world.physics.pickEntityAt(worldPt);
      if (s.toolMode === "move" && picked !== undefined) {
        const transform = transforms.get(picked);
        if (transform) {
          store.dispatch({ type: "select-entity", entity: picked });
          store.dispatch({ type: "set-lock", target: undefined });
          entityDrag = { entity: picked, offsetX: worldPt.x - transform.position.x, offsetY: worldPt.y - transform.position.y };
          didDrag = false;
          suppressCanvasClick = false;
          renderer.canvas.setPointerCapture(event.pointerId);
          render();
          return;
        }
      }
    }
  };

  const handleCanvasPointerMove = (event: PointerEvent) => {
    const s = getState();
    if (gizmoDrag) {
      const worldPt = renderer.screenToWorld(event.clientX, event.clientY);
      applyGizmoDrag(world, gizmoDrag, worldPt, {
        grid: s.snapGrid,
        gridSize: s.snapGridSize,
        rotate: s.snapRotate,
        rotateDeg: s.snapRotateDeg,
      });
      engine.tick(0);
      markWorldDirty();
      didDrag = true;
      suppressCanvasClick = true;
      render();
      return;
    }

    if (entityDrag) {
      const worldPt = renderer.screenToWorld(event.clientX, event.clientY);
      const nextX = s.snapGrid ? snapToGrid(worldPt.x - entityDrag.offsetX, s.snapGridSize) : worldPt.x - entityDrag.offsetX;
      const nextY = s.snapGrid ? snapToGrid(worldPt.y - entityDrag.offsetY, s.snapGridSize) : worldPt.y - entityDrag.offsetY;
      const transform = transforms.get(entityDrag.entity);
      if (transform) {
        transform.position.x = nextX;
        transform.position.y = nextY;
      }
      world.physics.reset(entityDrag.entity, { x: nextX, y: nextY }, { x: 0, y: 0 });
      engine.tick(0);
      markWorldDirty();
      didDrag = true;
      suppressCanvasClick = true;
      render();
      return;
    }

    if (!drag || s.lockTarget !== undefined) return;
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4) didDrag = true;
    const rect = renderer.canvas.getBoundingClientRect();
    const cssScale = rect.width / renderer.canvas.width;
    store.dispatch({
      type: "set-camera",
      camera: {
        zoom: s.camera.zoom,
        x: drag.camX + (event.clientX - drag.startX) / cssScale,
        y: drag.camY + (event.clientY - drag.startY) / cssScale,
      },
    });
    render();
  };

  const handleCanvasPointerUp = () => {
    drag = null;
    entityDrag = null;
    gizmoDrag = null;
  };

  const handleCanvasWheel = (event: WheelEvent) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const s = getState();
    const camera = wheelZoomCamera(
      s.camera,
      renderer.canvas.getBoundingClientRect(),
      renderer.canvas.width,
      event.clientX,
      event.clientY,
      event.deltaY,
      event.deltaMode,
      s.cameraZoomSensitivity,
    );
    store.dispatch({ type: "set-camera", camera });
    render();
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest("[data-dropdown-root]") && getState().openDropdown !== undefined) {
      store.dispatch({ type: "close-menus" });
      render();
    }
  };

  const removeKeyboard = installKeyboard({
    isPlaying: () => options.playback?.getState?.() === "playing",
    setTool: (mode) => { store.dispatch({ type: "set-tool", mode }); render(); },
    save: () => saveActiveWorld(),
  });

  document.addEventListener("click", handleDocumentClick);
  engine.app.canvas.addEventListener("click", handleCanvasClick);
  engine.app.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  engine.app.canvas.addEventListener("pointermove", handleCanvasPointerMove);
  engine.app.canvas.addEventListener("pointerup", handleCanvasPointerUp);
  engine.app.canvas.addEventListener("pointerleave", handleCanvasPointerUp);
  engine.app.canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });

  render();

  return {
    world,
    setActiveSystems(names: string[]) {
      options.activeSystems = names;
      render();
    },
    setContentTree(tree: ContentTreeNode[]) {
      options.contentTree = tree;
      render();
    },
    setBookmarks(bookmarks: ContentBookmark[]) {
      options.bookmarks = bookmarks;
      render();
    },
    // Sync open world/doc tabs (and the active-world identity) after a content
    // rename, so a renamed world's tab relabels instead of going stale.
    renameContent(from: string, to: string) {
      store.dispatch({ type: "rename-path", from, to });
      const remap = (path?: string) =>
        !path
          ? path
          : path === from
            ? to
            : path.startsWith(`${from}/`)
              ? `${to}/${path.slice(from.length + 1)}`
              : path;
      const nextActive = remap(options.activeWorld);
      if (nextActive !== options.activeWorld) options.activeWorld = nextActive;
      render();
    },
    setActiveWorld(name: string, opts?: { activeSystems?: string[]; contentTree?: ContentTreeNode[] }) {
      options.activeWorld = name;
      if (opts?.activeSystems) options.activeSystems = opts.activeSystems;
      if (opts?.contentTree) options.contentTree = opts.contentTree;
      store.dispatch({ type: "reset-selection" });
      store.dispatch({ type: "set-world-dirty", dirty: false });
      renderer.setPixelFiltering();
      centerCamera();
      render();
    },
    destroy() {
      renderer.destroy();
      layout.remove();
      shell.classList.remove("app-shell--debug");
      resizeObserver.disconnect();
      engine.app.canvas.removeEventListener("click", handleCanvasClick);
      engine.app.canvas.removeEventListener("pointerdown", handleCanvasPointerDown);
      engine.app.canvas.removeEventListener("pointermove", handleCanvasPointerMove);
      engine.app.canvas.removeEventListener("pointerup", handleCanvasPointerUp);
      engine.app.canvas.removeEventListener("pointerleave", handleCanvasPointerUp);
      engine.app.canvas.removeEventListener("wheel", handleCanvasWheel);
      document.removeEventListener("click", handleDocumentClick);
      removeKeyboard();
      reactRoot.unmount();
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}

function loadCameraZoomSensitivity() {
  if (typeof localStorage === "undefined") return DEFAULT_CAMERA_ZOOM_SENSITIVITY;
  const raw = localStorage.getItem(CAMERA_ZOOM_SENSITIVITY_STORAGE_KEY);
  if (raw === null) return DEFAULT_CAMERA_ZOOM_SENSITIVITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? Math.min(MAX_CAMERA_ZOOM_SENSITIVITY, Math.max(MIN_CAMERA_ZOOM_SENSITIVITY, parsed))
    : DEFAULT_CAMERA_ZOOM_SENSITIVITY;
}

function saveCameraZoomSensitivity(value: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CAMERA_ZOOM_SENSITIVITY_STORAGE_KEY, String(value));
}
