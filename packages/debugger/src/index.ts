import { getComponentRegistry, type ComponentRegistryEntry, type Entity, type World, type WorldDebugEvent } from "@engine/ecs-core";
import type { Physics, PhysicsDebugEvent } from "@engine/physics";
import { sprites, transforms, type EngineApplication, type TransformScale } from "@engine/renderer";
import { Container, Graphics, Text, TextureSource, type SCALE_MODE } from "pixi.js";

export type DebuggerWorld = World & { physics: Physics };

export type DebugEditorField = {
  label: string;
  value: string;
  secondary?: string;
  editable?: boolean;
  editKey?: string;
  selectEntity?: Entity;
  selectEntities?: Entity[];
};

export type DebugEditorSection<TWorld extends DebuggerWorld = DebuggerWorld> = {
  title: string;
  fields: DebugEditorField[] | ((world: TWorld, entity?: Entity) => DebugEditorField[]);
};

export type DebugInspectorComponent<TWorld extends DebuggerWorld = DebuggerWorld> = {
  id: string;
  title: string;
  fields: (world: TWorld, entity: Entity) => DebugEditorField[];
  set?: (world: TWorld, entity: Entity, key: string, value: string) => void;
};

export type DebugStoreInspectorOptions<TValue, TWorld extends DebuggerWorld = DebuggerWorld> = {
  id: string;
  title: string;
  store: Map<Entity, TValue>;
  fields: (value: TValue, world: TWorld, entity: Entity) => DebugEditorField[];
  set?: (value: TValue, key: string, next: string, world: TWorld, entity: Entity) => void;
};

export type DebugStatusPanel<TWorld extends DebuggerWorld = DebuggerWorld> = {
  id: string;
  title: string;
  fields: (world: TWorld) => DebugEditorField[];
};

export type DebugPlayback = {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onStep?: () => void;
  getState?: () => "playing" | "paused" | "stopped";
};

export type DebugTrackedStore = {
  label: string;
  store: Map<Entity, unknown>;
};

export type DebugGridOptions = {
  snapSize?: number;
  majorEvery?: number;
  minMinorScreenPx?: number;
  maxMinorScreenPx?: number;
};

export type RuntimeDebuggerOptions<TWorld extends DebuggerWorld = DebuggerWorld> = {
  getEntityTitle?: (world: TWorld, entity: Entity) => string;
  sections?: DebugEditorSection<TWorld>[];
  components?: DebugInspectorComponent<TWorld>[];
  statusPanels?: DebugStatusPanel<TWorld>[];
  getRuntimeDetails?: (world: TWorld, entity?: Entity) => string;
  playback?: DebugPlayback;
  trackedStores?: DebugTrackedStore[];
  grid?: DebugGridOptions;
};

export type DebugEditor<TWorld extends DebuggerWorld = DebuggerWorld> = {
  world: TWorld;
  destroy: () => void;
};

type FrameMetric = {
  label: string;
  durationMs: number;
};

type EntitySnapshot = {
  components: Map<string, unknown>;
  physics?: { x: number; y: number; vx: number; vy: number };
};

type WorldSnapshot = {
  frame: number;
  entities: Map<Entity, EntitySnapshot>;
};

type LogCategory = "entity" | "tag" | "system" | "physics" | "collision" | "store";
type LogEntry = { cat: LogCategory; text: string; count: number };

const ALL_LOG_CATEGORIES: LogCategory[] = ["entity", "tag", "collision", "physics", "store", "system"];
const DEFAULT_GRID_OPTIONS: Required<DebugGridOptions> = {
  snapSize: 16,
  majorEvery: 4,
  minMinorScreenPx: 10,
  maxMinorScreenPx: 28,
};

type DebugState = {
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
  lockTarget: Entity | undefined;
};

const STYLE_ID = "engine-runtime-debugger-style";

export function createStoreInspector<TValue, TWorld extends DebuggerWorld = DebuggerWorld>(
  options: DebugStoreInspectorOptions<TValue, TWorld>,
): DebugInspectorComponent<TWorld> {
  return {
    id: options.id,
    title: options.title,
    fields(world, entity) {
      const value = options.store.get(entity);
      if (value === undefined) return [];
      return options.fields(value, world, entity);
    },
    set(world, entity, key, next) {
      const value = options.store.get(entity);
      if (value === undefined || !options.set) return;
      options.set(value, key, next, world, entity);
    },
  };
}

export function attachRuntimeDebugger<TWorld extends DebuggerWorld>(
  world: TWorld,
  engine: EngineApplication,
  options: RuntimeDebuggerOptions<TWorld> = {},
): DebugEditor<TWorld> {
  ensureStyles();

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
    showPhysics: true,
    showLabels: true,
    showSprites: true,
    camera: { x: 0, y: 0, zoom: 1 },
    lockTarget: undefined,
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
  const storeSnapshots = new Map<string, string>();
  const labels = new Map<number, Text>();

  const viewportHud = document.createElement("div");
  viewportHud.className = "debugger-viewport-hud";
  viewportHud.innerHTML = `
    <div class="debugger-viewport-hud__item">
      <span class="debugger-viewport-hud__label">FPS:</span>
      <strong class="debugger-viewport-hud__value debugger-viewport-hud__value--fps" data-fps>0</strong>
    </div>
    <div class="debugger-viewport-hud__item">
      <span class="debugger-viewport-hud__label">MS:</span>
      <strong class="debugger-viewport-hud__value debugger-viewport-hud__value--ms" data-frame-ms>0.00</strong>
    </div>
  `;
  viewport.appendChild(viewportHud);

  const layout = document.createElement("div");
  layout.className = "debugger-layout";
  layout.innerHTML = `
    <header class="debugger-toolbar">
      <div class="debugger-toolbar__left">
        <div class="debugger-dropdown" data-dropdown="debug">
          <button class="debugger-dropdown__trigger" data-dropdown-trigger="debug">
            Debug <span aria-hidden="true">▾</span>
          </button>
          <div class="debugger-dropdown__panel">
            <button class="debugger-dropdown__item" data-toggle="grid">
              <span class="debugger-dropdown__item-icon">#</span>Grid
            </button>
            <button class="debugger-dropdown__item" data-toggle="physics">
              <span class="debugger-dropdown__item-icon">□</span>Physics
            </button>
            <button class="debugger-dropdown__item" data-toggle="labels">
              <span class="debugger-dropdown__item-icon">T</span>Labels
            </button>
            <button class="debugger-dropdown__item" data-toggle="sprites">
              <span class="debugger-dropdown__item-icon">⊡</span>Sprite Bounds
            </button>
          </div>
        </div>
      </div>
      <div class="debugger-toolbar__playback">
        <button data-action="play" title="Play" aria-label="Play">▶</button>
        <button data-action="pause" title="Pause" aria-label="Pause">Ⅱ</button>
        <button data-action="step" title="Step Frame" aria-label="Step Frame">▸|</button>
        <button data-action="stop" title="Restart" aria-label="Restart">↺</button>
      </div>
      <div class="debugger-toolbar__actions">
        <div class="debugger-zoom-group">
          <button data-action="zoom-out" title="Zoom Out">−</button>
          <button class="debugger-zoom-value" data-zoom-display data-action="zoom-100" title="Reset to 100%">100%</button>
          <button data-action="zoom-in" title="Zoom In">+</button>
          <button data-action="zoom-fit" title="Fit game in viewport">⊞</button>
          <div class="debugger-zoom-sep"></div>
          <button data-action="camera-reset" title="Reset Camera">⌖</button>
          <button data-toggle="camera-lock" title="Lock Camera to Entity">⊙</button>
        </div>
      </div>
    </header>
    <aside class="debugger-panel debugger-panel--left">
      <div class="debugger-sidepanels" data-status-panels></div>
      <section class="debugger-section">
        <div class="debugger-snapshot-header">
          <div class="debugger-section__title" style="margin-bottom:0">Snapshots</div>
          <button class="debugger-snapshot-save" data-snapshot-save>Save</button>
        </div>
        <div class="debugger-snapshot-list" data-snapshots></div>
      </section>
      <section class="debugger-section debugger-section--grow">
        <div class="debugger-section__title">Systems</div>
        <div class="debugger-systems" data-systems></div>
      </section>
    </aside>
    <aside class="debugger-panel debugger-panel--right">
      <section class="debugger-section debugger-section--entities">
        <div class="debugger-section__title">Entities</div>
        <input class="debugger-input" data-search placeholder="search entity or tag" />
        <div class="debugger-entity-list" data-entities-list></div>
      </section>
      <section class="debugger-section debugger-section--inspector">
        <div class="debugger-section__title">Inspector</div>
        <input class="debugger-input" data-inspector-search placeholder="filter fields…" />
        <div class="debugger-inspector" data-inspector></div>
      </section>
    </aside>
    <section class="debugger-panel debugger-panel--bottom">
      <section class="debugger-section debugger-section--grow">
        <div class="debugger-log-header">
          <div class="debugger-section__title">Event Log</div>
          <div class="debugger-log-controls" data-log-controls></div>
        </div>
        <div class="debugger-log" data-log></div>
      </section>
    </section>
  `;
  shell.appendChild(layout);

  const overlay = new Graphics();
  overlay.eventMode = "none";
  engine.app.stage.addChild(overlay);

  // store original game resolution and background to restore on destroy
  const gameW = engine.app.renderer.width;
  const gameH = engine.app.renderer.height;
  const origBg = engine.app.renderer.background.color;
  engine.app.renderer.background.color = 0x09090b;

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

  const centerCamera = () => {
    const w = engine.app.renderer.width;
    const h = engine.app.renderer.height;
    state.camera.zoom = Math.min(w / gameW, h / gameH) * 0.72;
    state.camera.x = (w - gameW * state.camera.zoom) / 2;
    state.camera.y = (h - gameH * state.camera.zoom) / 2;
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

  const searchInput = layout.querySelector<HTMLInputElement>("[data-search]");
  const controlsHost = layout.querySelector<HTMLElement>(".debugger-toolbar");

  refresh = () => {
    if (state.lockTarget !== undefined) {
      const t = transforms.get(state.lockTarget);
      if (t) {
        const w = engine.app.renderer.width;
        const h = engine.app.renderer.height;
        state.camera.x = w / 2 - t.x * state.camera.zoom;
        state.camera.y = h / 2 - t.y * state.camera.zoom;
      }
    }
    applyCameraToStage(engine.app.stage, state.camera);
    recordStoreDiffs(world, trackedStores, storeSnapshots, state);
    renderDebugger(
      world,
      layout,
      viewportHud,
      overlay,
      labels,
      state,
      componentInspectors,
      options,
      gridOptions,
      engine.app.renderer.width,
      engine.app.renderer.height,
      gameW,
      gameH,
    );
    bindEntitySelection(layout, state, refresh);
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
  let didDrag = false;

  const handleCanvasClick = (event: MouseEvent) => {
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
    if (event.button !== 1) return;
    event.preventDefault();
    drag = { startX: event.clientX, startY: event.clientY, camX: state.camera.x, camY: state.camera.y };
    didDrag = false;
    engine.app.canvas.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: PointerEvent) => {
    if (!drag || state.lockTarget !== undefined) return;
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4) didDrag = true;
    const rect = engine.app.canvas.getBoundingClientRect();
    const cssScale = rect.width / engine.app.canvas.width;
    state.camera.x = drag.camX + (event.clientX - drag.startX) / cssScale;
    state.camera.y = drag.camY + (event.clientY - drag.startY) / cssScale;
    refresh();
  };

  const handleCanvasPointerUp = () => { drag = null; };

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
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    state.camera.zoom = Math.max(0.1, Math.min(20, state.camera.zoom * factor));
    state.camera.x = cx - wx * state.camera.zoom;
    state.camera.y = cy - wy * state.camera.zoom;
    refresh();
  };

  const closeDropdowns = () => {
    for (const d of layout.querySelectorAll<HTMLElement>("[data-dropdown].is-open")) {
      d.classList.remove("is-open");
    }
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest("[data-dropdown]")) closeDropdowns();
  };
  document.addEventListener("click", handleDocumentClick);

  const handleControlsClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const dropdownTrigger = target.closest<HTMLElement>("[data-dropdown-trigger]");
    if (dropdownTrigger) {
      const name = dropdownTrigger.dataset.dropdownTrigger;
      const dropdown = layout.querySelector<HTMLElement>(`[data-dropdown="${name}"]`);
      if (dropdown) dropdown.classList.toggle("is-open");
      return;
    }

    const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset.action;
    const toggle = target.closest<HTMLButtonElement>("[data-toggle]")?.dataset.toggle;

    if (toggle) {
      if (toggle === "grid") {
        state.showGrid = !state.showGrid;
        shell.classList.toggle("app-shell--debug-grid-off", !state.showGrid);
      }
      if (toggle === "physics") state.showPhysics = !state.showPhysics;
      if (toggle === "labels") state.showLabels = !state.showLabels;
      if (toggle === "sprites") state.showSprites = !state.showSprites;
      if (toggle === "camera-lock") {
        state.lockTarget = state.lockTarget !== undefined ? undefined : state.selectedEntity;
      }
      refresh();
      return;
    }

    if (!action) return;
    if (target.closest(".debugger-dropdown__panel")) closeDropdowns();
    if (action === "zoom-in" || action === "zoom-out" || action === "zoom-100") {
      const w = engine.app.renderer.width;
      const h = engine.app.renderer.height;
      const cx = w / 2;
      const cy = h / 2;
      const wx = (cx - state.camera.x) / state.camera.zoom;
      const wy = (cy - state.camera.y) / state.camera.zoom;
      const factor = action === "zoom-in" ? 1.25 : action === "zoom-out" ? 1 / 1.25 : null;
      state.camera.zoom = factor !== null
        ? Math.max(0.1, Math.min(20, state.camera.zoom * factor))
        : 1;
      state.camera.x = cx - wx * state.camera.zoom;
      state.camera.y = cy - wy * state.camera.zoom;
      applyCameraToStage(engine.app.stage, state.camera);
      refresh();
      return;
    }
    if (action === "zoom-fit") {
      state.lockTarget = undefined;
      centerCamera();
      applyCameraToStage(engine.app.stage, state.camera);
      refresh();
      return;
    }
    if (action === "camera-reset") {
      state.camera.zoom = 1;
      state.lockTarget = undefined;
      centerCamera();
      applyCameraToStage(engine.app.stage, state.camera);
      refresh();
      return;
    }
    if (action === "play") options.playback?.onPlay?.();
    if (action === "pause") options.playback?.onPause?.();
    if (action === "step") options.playback?.onStep?.();
    if (action === "stop") options.playback?.onStop?.();
    syncPlayback(layout, options.playback?.getState?.() ?? "playing", state);
  };

  const handleSearchInput = () => {
    renderEntityList(world, layout, state.selectedEntity, options.getEntityTitle);
  };

  const handleInspectorChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const entity = target.dataset.entity;
    const component = target.dataset.component;
    const key = target.dataset.key;
    if (!entity || !component || !key) return;

    applyInspectorEdit(world, componentInspectorMap, Number(entity), component, key, target.value);
    refresh();
  };

  const handleInspectorClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const collapseBtn = target.closest<HTMLButtonElement>("[data-collapse-component]");
    if (collapseBtn) {
      const id = collapseBtn.dataset.collapseComponent;
      if (id !== undefined) {
        if (state.collapsedComponents.has(id)) state.collapsedComponents.delete(id);
        else state.collapsedComponents.add(id);
        refresh();
      }
      return;
    }

    const selectButton = target.closest<HTMLButtonElement>("[data-select-entity]");
    if (!selectButton) return;

    const entity = selectButton.dataset.selectEntity;
    if (entity === undefined) return;
    state.selectedEntity = Number(entity);
    refresh();
  };

  const handleInspectorSearch = () => refresh();

  const handleLogClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const toggle = target.closest<HTMLButtonElement>("[data-log-toggle]")?.dataset.logToggle as LogCategory | undefined;
    if (toggle) {
      if (state.logFilter.has(toggle)) state.logFilter.delete(toggle);
      else state.logFilter.add(toggle);
      refresh();
      return;
    }

    if (target.closest("[data-log-pause]")) {
      state.logPaused = !state.logPaused;
      refresh();
    }
  };

  const handleSystemsClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>("[data-system-index]");
    if (!button) return;
    const index = Number(button.dataset.systemIndex);
    const entries = world.getSystemEntries();
    world.setSystemEnabled(index, !entries[index]?.enabled);
    refresh();
  };

  const handleSnapshotsClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest("[data-snapshot-save]")) {
      state.snapshots.unshift(captureSnapshot(world, registry));
      if (state.snapshots.length > 5) state.snapshots.length = 5;
      refresh();
      return;
    }

    const restoreBtn = target.closest<HTMLButtonElement>("[data-snapshot-restore]");
    if (restoreBtn) {
      const index = Number(restoreBtn.dataset.snapshotRestore);
      const snap = state.snapshots[index];
      if (snap) {
        restoreSnapshot(world, snap, registry);
        engine.tick(0);
      }
      refresh();
    }
  };

  engine.app.canvas.addEventListener("click", handleCanvasClick);
  engine.app.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  engine.app.canvas.addEventListener("pointermove", handleCanvasPointerMove);
  engine.app.canvas.addEventListener("pointerup", handleCanvasPointerUp);
  engine.app.canvas.addEventListener("pointerleave", handleCanvasPointerUp);
  shell.addEventListener("wheel", handleCanvasWheel, { passive: false });
  controlsHost?.addEventListener("click", handleControlsClick);
  searchInput?.addEventListener("input", handleSearchInput);
  layout.querySelector<HTMLElement>("[data-inspector]")?.addEventListener("change", handleInspectorChange);
  layout.querySelector<HTMLElement>("[data-inspector]")?.addEventListener("click", handleInspectorClick);
  layout.querySelector<HTMLElement>("[data-inspector-search]")?.addEventListener("input", handleInspectorSearch);
  layout.querySelector<HTMLElement>("[data-systems]")?.addEventListener("click", handleSystemsClick);
  layout.querySelector<HTMLElement>(".debugger-panel--bottom")?.addEventListener("click", handleLogClick);
  layout.querySelector<HTMLElement>(".debugger-panel--left")?.addEventListener("click", handleSnapshotsClick);

  refresh();

  return {
    world,
    destroy() {
      overlay.destroy();
      for (const label of labels.values()) label.destroy();
      labels.clear();
      viewportHud.remove();
      layout.remove();
      shell.classList.remove("app-shell--debug");
      shell.classList.remove("app-shell--debug-grid-off");
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
      controlsHost?.removeEventListener("click", handleControlsClick);
      searchInput?.removeEventListener("input", handleSearchInput);
      layout.querySelector<HTMLElement>("[data-inspector]")?.removeEventListener("change", handleInspectorChange);
      layout.querySelector<HTMLElement>("[data-inspector]")?.removeEventListener("click", handleInspectorClick);
      layout.querySelector<HTMLElement>("[data-inspector-search]")?.removeEventListener("input", handleInspectorSearch);
      layout.querySelector<HTMLElement>("[data-systems]")?.removeEventListener("click", handleSystemsClick);
      layout.querySelector<HTMLElement>(".debugger-panel--bottom")?.removeEventListener("click", handleLogClick);
      layout.querySelector<HTMLElement>(".debugger-panel--left")?.removeEventListener("click", handleSnapshotsClick);
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .app-shell--debug {
      position: fixed !important;
      inset: 0;
      display: block !important;
      padding: 0 !important;
      overflow: hidden;
    }
    .app-shell--debug .game-frame {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
      aspect-ratio: unset !important;
      z-index: 1;
    }
    .debugger-viewport-hud {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 4;
      pointer-events: none;
      display: flex;
      gap: 12px;
      padding: 4px 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      background: rgba(5, 5, 5, 0.8);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(10px);
      color: #e4e4e7;
      font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-viewport-hud__item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .debugger-viewport-hud__label {
      color: #71717a;
    }
    .debugger-viewport-hud__value {
      font-weight: 700;
    }
    .debugger-viewport-hud__value--fps {
      color: #4ade80;
    }
    .debugger-viewport-hud__value--ms {
      color: #facc15;
    }
    .debugger-layout {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: 270px 1fr 290px;
      grid-template-rows: 56px 1fr 150px;
      grid-template-areas:
        "top top top"
        "left . right"
        "left bottom right";
      gap: 10px;
      padding: 10px;
      box-sizing: border-box;
      pointer-events: none;
    }
    .debugger-toolbar {
      grid-area: top;
      pointer-events: auto;
      position: relative;
      z-index: 20;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: rgba(10, 10, 12, 0.94);
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(18px);
      color: #e4e4e7;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-toolbar__left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .debugger-toolbar__playback {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      background: #18181b;
    }
    .debugger-toolbar__playback button {
      width: 34px;
      height: 28px;
      border: 1px solid transparent;
      border-radius: 9px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font: 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      display: grid;
      place-items: center;
    }
    .debugger-toolbar__playback button:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #e4e4e7;
    }
    .debugger-toolbar__playback button.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.22);
      color: #bfdbfe;
    }
    .debugger-toolbar__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }
    .debugger-panel {
      pointer-events: auto;
      position: relative;
      z-index: 1;
      min-height: 0;
      display: grid;
      gap: 10px;
      padding: 12px;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: rgba(10, 10, 12, 0.94);
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(18px);
      color: #e4e4e7;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-panel--left {
      grid-area: left;
      grid-template-rows: auto auto minmax(0, 1fr);
    }
    .debugger-panel--right {
      grid-area: right;
      grid-template-rows: minmax(220px, 42%) minmax(0, 1fr);
    }
    .debugger-panel--bottom {
      grid-area: bottom;
      grid-template-rows: minmax(0, 1fr);
      min-height: 0;
    }
    .debugger-title {
      font-size: 13px;
      font-weight: 700;
      color: #fafafa;
    }
    .debugger-subtitle {
      color: #a1a1aa;
    }
    .debugger-badge {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.18);
      color: #93c5fd;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
    }
    .debugger-controls {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
    }
    .debugger-controls--header {
      grid-template-columns: repeat(10, 32px);
      gap: 6px;
    }
    .debugger-controls button {
      height: 32px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: #18181b;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }
    .debugger-controls--header button {
      width: 32px;
      padding: 0;
      font-size: 13px;
      display: grid;
      place-items: center;
    }
    .debugger-controls button:hover {
      background: #27272a;
    }
    .debugger-controls button.is-active {
      border-color: rgba(96, 165, 250, 0.45);
      background: rgba(37, 99, 235, 0.24);
      color: #bfdbfe;
    }
    .debugger-dropdown {
      position: relative;
    }
    .debugger-dropdown__trigger {
      height: 32px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: #18181b;
      color: #e4e4e7;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .debugger-dropdown__trigger:hover {
      background: #27272a;
    }
    .debugger-dropdown.is-open .debugger-dropdown__trigger {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-dropdown__panel {
      display: none;
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 180px;
      padding: 5px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      background: rgba(10, 10, 12, 0.98);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
      z-index: 100;
    }
    .debugger-dropdown.is-open .debugger-dropdown__panel {
      display: grid;
      gap: 1px;
    }
    .debugger-dropdown__item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      height: 32px;
      padding: 0 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font: inherit;
      text-align: left;
      box-sizing: border-box;
    }
    .debugger-dropdown__item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
    }
    .debugger-dropdown__item.is-active {
      border-color: rgba(96, 165, 250, 0.3);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-dropdown__item-icon {
      width: 18px;
      text-align: center;
      font-size: 13px;
      flex-shrink: 0;
      opacity: 0.6;
    }
    .debugger-dropdown__item.is-active .debugger-dropdown__item-icon {
      opacity: 1;
    }
    .debugger-dropdown__divider {
      height: 1px;
      margin: 3px 4px;
      background: rgba(255, 255, 255, 0.08);
    }
    .debugger-section {
      min-height: 0;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(24, 24, 27, 0.8);
      overflow: hidden;
    }
    .debugger-section--grow {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .debugger-section--entities {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
    }
    .debugger-section--inspector {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
    }
    .debugger-section__title {
      margin-bottom: 8px;
      color: #f4f4f5;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.08em;
    }
    .debugger-kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #a1a1aa;
    }
    .debugger-kv strong {
      color: #fafafa;
    }
    .debugger-input {
      width: 100%;
      height: 30px;
      margin-bottom: 8px;
      padding: 0 8px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      background: #09090b;
      color: inherit;
      font: inherit;
    }
    .debugger-entity-list,
    .debugger-systems,
    .debugger-inspector {
      display: grid;
      align-content: start;
      gap: 6px;
      min-height: 0;
      overflow: auto;
    }
    .debugger-sidepanels {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .debugger-entity {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: #09090b;
      cursor: pointer;
    }
    .debugger-entity.is-selected {
      border-color: rgba(96, 165, 250, 0.8);
      background: rgba(30, 41, 59, 0.9);
      box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.35);
    }
    .debugger-pill {
      color: #93c5fd;
      font-size: 10px;
    }
    .debugger-card {
      padding: 8px;
      border-radius: 10px;
      background: #09090b;
    }
    .debugger-card--collapsed .debugger-card__header {
      margin-bottom: 0;
    }
    .debugger-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .debugger-card__title {
      color: #fafafa;
      font-weight: 700;
    }
    .debugger-card__collapse {
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      background: transparent;
      color: #52525b;
      cursor: pointer;
      font: inherit;
      font-size: 10px;
      line-height: 1;
      flex-shrink: 0;
    }
    .debugger-card__collapse:hover { color: #a1a1aa; }
    .debugger-field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      color: #a1a1aa;
    }
    .debugger-field--editable {
      cursor: text;
      border-left: 2px solid rgba(96, 165, 250, 0.35);
      padding-left: 4px;
    }
    .debugger-field strong {
      color: #fafafa;
      text-align: right;
    }
    .debugger-field__input {
      width: 88px;
      height: 24px;
      padding: 0 6px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      background: #111114;
      color: #fafafa;
      text-align: right;
      font: inherit;
    }
    .debugger-field__links {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }
    .debugger-field__link {
      height: 22px;
      padding: 0 6px;
      border: 1px solid rgba(96, 165, 250, 0.28);
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.16);
      color: #bfdbfe;
      cursor: pointer;
      font: inherit;
    }
    .debugger-field__link:hover {
      background: rgba(37, 99, 235, 0.28);
    }
    .debugger-system__toggle {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: #4ade80;
      cursor: pointer;
      font: inherit;
      font-size: 10px;
      line-height: 1;
    }
    .debugger-system--disabled .debugger-system__toggle {
      color: #52525b;
    }
    .debugger-system__label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-system--disabled .debugger-system__label,
    .debugger-system--disabled strong {
      color: #52525b;
    }
    .debugger-log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .debugger-log-header .debugger-section__title {
      margin-bottom: 0;
    }
    .debugger-log-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .debugger-log-chip {
      height: 18px;
      padding: 0 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      background: transparent;
      color: #71717a;
      cursor: pointer;
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-log-chip.is-active {
      background: rgba(255, 255, 255, 0.08);
      color: #d4d4d8;
    }
    .debugger-log-chip--pause.is-active {
      background: rgba(251, 191, 36, 0.15);
      border-color: rgba(251, 191, 36, 0.3);
      color: #fbbf24;
    }
    .debugger-log {
      margin: 0;
      min-height: 0;
      overflow: auto;
      color: #d4d4d8;
      font-size: 11px;
      line-height: 1.4;
    }
    .debugger-log__entry {
      padding: 1px 0;
      border-left: 2px solid transparent;
      padding-left: 5px;
      white-space: pre-wrap;
    }
    .debugger-log__entry--entity  { border-color: #60a5fa; }
    .debugger-log__entry--tag     { border-color: #a78bfa; }
    .debugger-log__entry--system  { border-color: #facc15; }
    .debugger-log__entry--physics { border-color: #fb923c; }
    .debugger-log__entry--collision { border-color: #f87171; }
    .debugger-log__entry--store   { border-color: #4ade80; }
    .debugger-log__empty {
      color: #52525b;
      font-size: 11px;
    }
    .debugger-log__count {
      margin-left: 6px;
      padding: 0 5px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: #71717a;
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }
    .debugger-system__timing {
      font-size: 10px;
      color: #a1a1aa;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .debugger-snapshot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .debugger-snapshot-save {
      height: 22px;
      padding: 0 8px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      background: #18181b;
      color: #d4d4d8;
      cursor: pointer;
      font: inherit;
    }
    .debugger-snapshot-save:hover { background: #27272a; }
    .debugger-snapshot-list {
      display: grid;
      gap: 4px;
    }
    .debugger-snapshot-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 6px;
      background: #09090b;
      font-size: 11px;
      color: #a1a1aa;
    }
    .debugger-snapshot-row__label { color: #d4d4d8; }
    .debugger-snapshot-restore {
      height: 20px;
      padding: 0 6px;
      border: 1px solid rgba(96,165,250,0.28);
      border-radius: 999px;
      background: rgba(37,99,235,0.16);
      color: #bfdbfe;
      cursor: pointer;
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-snapshot-restore:hover { background: rgba(37,99,235,0.28); }
    .debugger-zoom-group {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px 5px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      background: #18181b;
    }
    .debugger-zoom-group button {
      height: 24px;
      min-width: 24px;
      padding: 0 5px;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      line-height: 1;
    }
    .debugger-zoom-group button:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .debugger-zoom-group button.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.22);
      color: #bfdbfe;
    }
    .debugger-zoom-value {
      min-width: 44px;
      text-align: center;
      font-size: 11px !important;
      font-variant-numeric: tabular-nums;
      color: #a1a1aa !important;
      letter-spacing: 0.02em;
    }
    .debugger-zoom-value:hover {
      color: #e4e4e7 !important;
    }
    .debugger-zoom-sep {
      width: 1px;
      height: 16px;
      background: rgba(255, 255, 255, 0.12);
      margin: 0 2px;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

function renderDebugger<TWorld extends DebuggerWorld>(
  world: TWorld,
  sidebar: HTMLElement,
  viewportHud: HTMLElement,
  overlay: Graphics,
  labels: Map<number, Text>,
  state: DebugState,
  components: DebugInspectorComponent<TWorld>[],
  options: RuntimeDebuggerOptions<TWorld>,
  gridOptions: Required<DebugGridOptions>,
  viewportW?: number,
  viewportH?: number,
  gameW?: number,
  gameH?: number,
) {
  renderOverview(sidebar, viewportHud, state, options.playback?.getState?.() ?? "playing");
  renderStatusPanels(world, sidebar, options.statusPanels ?? []);
  renderSnapshots(sidebar, state);
  renderEntityList(world, sidebar, state.selectedEntity, options.getEntityTitle);
  renderInspector(world, sidebar, state.selectedEntity, components, options, state);
  renderSystems(sidebar, world, state.systemMetrics, state.systemTimingHistory);
  renderLog(sidebar, state);
  renderPhysicsOverlay(world, overlay, labels, state.selectedEntity, options.getEntityTitle, state, gridOptions, viewportW, viewportH, gameW, gameH);
}

function renderOverview(
  sidebar: HTMLElement,
  viewportHud: HTMLElement,
  state: DebugState,
  playbackState: "playing" | "paused" | "stopped",
) {
  setText(sidebar, "[data-frame]", String(state.latestFrame));
  setText(sidebar, "[data-zoom-display]", `${Math.round(state.camera.zoom * 100)}%`);
  setText(viewportHud, "[data-fps]", state.fps.toFixed(1));
  setText(viewportHud, "[data-frame-ms]", state.latestFrameMs.toFixed(2));
  syncPlayback(sidebar, playbackState, state);
}

function renderEntityList<TWorld extends DebuggerWorld>(
  world: TWorld,
  sidebar: HTMLElement,
  selectedEntity: Entity | undefined,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
) {
  const host = sidebar.querySelector<HTMLElement>("[data-entities-list]");
  const query = sidebar.querySelector<HTMLInputElement>("[data-search]")?.value.trim().toLowerCase() ?? "";
  if (!host) return;

  host.innerHTML = Array.from(world.entities)
    .filter((entity) => {
      const title = getEntityTitle?.(world, entity) ?? entityListTitle(world, entity);
      const tags = world.tags.list(entity).join(" ");
      return `${title} ${tags} ${entity}`.toLowerCase().includes(query);
    })
    .map((entity) => {
      const title = getEntityTitle?.(world, entity) ?? entityListTitle(world, entity);
      const tag = world.tags.list(entity)[0] ?? "entity";
      return `
        <button class="debugger-entity${entity === selectedEntity ? " is-selected" : ""}" data-entity="${entity}">
          <span>${title}</span>
          <span class="debugger-pill">${tag}</span>
        </button>
      `;
    })
    .join("");

  host.querySelector<HTMLElement>(".is-selected")?.scrollIntoView({ block: "nearest", behavior: "instant" });
}

function renderStatusPanels<TWorld extends DebuggerWorld>(
  world: TWorld,
  sidebar: HTMLElement,
  panels: DebugStatusPanel<TWorld>[],
) {
  const host = sidebar.querySelector<HTMLElement>("[data-status-panels]");
  if (!host) return;

  host.innerHTML = panels
    .map((panel) => {
      const fields = panel.fields(world);
      if (fields.length === 0) return "";
      return renderRuntimeCard(panel.title, fields.map((field) => ({
        label: field.label,
        value: field.secondary === undefined ? field.value : `${field.value}, ${field.secondary}`,
      })));
    })
    .join("");
}

function bindEntitySelection(
  root: HTMLElement,
  state: DebugState,
  refresh: () => void,
) {
  for (const row of root.querySelectorAll<HTMLElement>("[data-entity]")) {
    row.onclick = () => {
      const entity = row.dataset.entity;
      if (entity === undefined) return;
      state.selectedEntity = Number(entity);
      refresh();
    };
  }
}

function renderInspector<TWorld extends DebuggerWorld>(
  world: TWorld,
  sidebar: HTMLElement,
  entity: Entity | undefined,
  components: DebugInspectorComponent<TWorld>[],
  options: RuntimeDebuggerOptions<TWorld>,
  state: DebugState,
) {
  const host = sidebar.querySelector<HTMLElement>("[data-inspector]");
  if (!host) return;

  if (entity === undefined) {
    host.innerHTML = "";
    return;
  }

  const query = sidebar.querySelector<HTMLInputElement>("[data-inspector-search]")?.value.trim().toLowerCase() ?? "";
  const cards: string[] = [];

  for (const component of components) {
    const fields = component.fields(world, entity);
    if (fields.length === 0) continue;
    const collapsed = state.collapsedComponents.has(component.id);
    const visible = collapsed ? fields : fields.filter((f) =>
      !query || component.title.toLowerCase().includes(query) || f.label.toLowerCase().includes(query),
    );
    if (!collapsed && query && visible.length === 0) continue;
    cards.push(renderCard(component.id, component.title, entity, collapsed ? [] : visible, collapsed));
  }

  const runtimeFields = [{ label: "Details", value: options.getRuntimeDetails?.(world, entity) ?? defaultRuntimeDetails(world, entity) }];
  const runtimeVisible = runtimeFields.filter((f) => !query || "runtime".includes(query) || f.label.toLowerCase().includes(query));
  if (!query || runtimeVisible.length > 0) {
    cards.push(renderRuntimeCard("Runtime", runtimeVisible));
  }

  host.innerHTML = cards.join("");
}

function createBuiltinInspectorComponents<TWorld extends DebuggerWorld>(
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): DebugInspectorComponent<TWorld>[] {
  return [
    {
      id: "entity",
      title: "Entity",
      fields(world, entity) {
        return [
          { label: "Id", value: `#${entity}`, selectEntity: entity },
          { label: "Name", value: getEntityTitle?.(world, entity) ?? entityTitle(world, entity) },
          { label: "Tags", value: world.tags.list(entity).join(", ") || "-" },
        ];
      },
    },
    {
      id: "transform",
      title: "Transform",
      fields(world, entity) {
        const transform = transforms.get(entity);
        if (!transform) return [];
        const scale = normalizeScale(transform.scale);
        return [
          { label: "X", value: formatNumber(transform.x), editable: true, editKey: "x" },
          { label: "Y", value: formatNumber(transform.y), editable: true, editKey: "y" },
          { label: "Scale X", value: formatNumber(scale.x), editable: true, editKey: "scaleX" },
          { label: "Scale Y", value: formatNumber(scale.y), editable: true, editKey: "scaleY" },
          { label: "Rot", value: formatNumber(transform.rotation), editable: true, editKey: "rotation" },
        ];
      },
      set(world, entity, key, rawValue) {
        const next = Number(rawValue);
        if (Number.isNaN(next)) return;

        const transform = transforms.get(entity);
        if (!transform) return;

        if (key === "x") transform.x = next;
        if (key === "y") transform.y = next;
        if (key === "rotation") transform.rotation = next;
        if (key === "scaleX" || key === "scaleY") {
          const scale = normalizeScale(transform.scale);
          if (key === "scaleX") scale.x = next;
          if (key === "scaleY") scale.y = next;
          transform.scale = scale;
        }
      },
    },
    {
      id: "physics",
      title: "Physics",
      fields(world, entity) {
        const body = world.physics.getDebugBodies().find((item) => item.entity === entity);
        if (!body) return [];
        return [
          { label: "Kind", value: body.kind },
          { label: "Bounds", value: `${formatNumber(body.width)} x ${formatNumber(body.height)}` },
          { label: "Colliding", value: body.isColliding ? "yes" : "no" },
        ];
      },
    },
  ];
}

function renderSnapshots(sidebar: HTMLElement, state: DebugState) {
  const host = sidebar.querySelector<HTMLElement>("[data-snapshots]");
  if (!host) return;

  if (state.snapshots.length === 0) {
    host.innerHTML = `<span style="color:#52525b;font-size:11px">none saved</span>`;
    return;
  }

  host.innerHTML = state.snapshots
    .map((snap, i) => `
      <div class="debugger-snapshot-row">
        <span class="debugger-snapshot-row__label">frame ${snap.frame}</span>
        <span>${snap.entities.size} entities</span>
        <button class="debugger-snapshot-restore" data-snapshot-restore="${i}">Restore</button>
      </div>
    `)
    .join("");
}

function captureSnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  registry: readonly ComponentRegistryEntry[],
): WorldSnapshot {
  const entities = new Map<Entity, EntitySnapshot>();

  for (const entity of world.entities) {
    const components = new Map<string, unknown>();
    for (const entry of registry) {
      const value = entry.store.get(entity);
      if (value !== undefined) components.set(entry.id, structuredClone(value));
    }

    const rigidBody = world.physics.rigidBodies.get(entity);
    const physics = rigidBody
      ? {
          x: rigidBody.body.position.x - rigidBody.width / 2,
          y: rigidBody.body.position.y - rigidBody.height / 2,
          vx: rigidBody.body.velocity.x,
          vy: rigidBody.body.velocity.y,
        }
      : undefined;

    entities.set(entity, { components, physics });
  }

  return { frame: world.getFrame(), entities };
}

function restoreSnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  snapshot: WorldSnapshot,
  registry: readonly ComponentRegistryEntry[],
) {
  for (const [entity, data] of snapshot.entities) {
    if (!world.entities.has(entity)) continue;

    for (const entry of registry) {
      const value = data.components.get(entry.id);
      if (value !== undefined) entry.store.set(entity, structuredClone(value));
      else entry.store.delete(entity);
    }

    if (data.physics) {
      world.physics.reset(entity, { x: data.physics.x, y: data.physics.y }, { x: data.physics.vx, y: data.physics.vy });
      const transform = transforms.get(entity);
      if (transform) {
        transform.x = data.physics.x;
        transform.y = data.physics.y;
      }
    }
  }
}

function renderSystems<TWorld extends DebuggerWorld>(sidebar: HTMLElement, world: TWorld, metrics: FrameMetric[], history: Map<string, number[]>) {
  const host = sidebar.querySelector<HTMLElement>("[data-systems]");
  if (!host) return;

  const entries = world.getSystemEntries();
  if (entries.length === 0) {
    host.innerHTML = `<div class="debugger-card"><div class="debugger-field"><span>systems</span><strong>waiting for frame</strong></div></div>`;
    return;
  }

  const metricByLabel = new Map(metrics.map((m) => [m.label, m]));

  host.innerHTML = entries
    .map((entry, index) => {
      const metric = metricByLabel.get(entry.label);
      const hist = history.get(entry.label) ?? [];
      const cur = metric ? metric.durationMs : null;
      const avg = hist.length > 0 ? hist.reduce((a, b) => a + b, 0) / hist.length : null;
      const peak = hist.length > 0 ? Math.max(...hist) : null;
      const timing = !entry.enabled ? "off"
        : cur === null ? "—"
        : `${cur.toFixed(2)} / ${avg?.toFixed(2) ?? "—"} / ${peak?.toFixed(2) ?? "—"}`;
      const activeClass = entry.enabled ? "" : " debugger-system--disabled";
      return `
        <div class="debugger-card debugger-system${activeClass}">
          <div class="debugger-field">
            <button class="debugger-system__toggle" data-system-index="${index}" title="${entry.enabled ? "Disable" : "Enable"} system">${entry.enabled ? "●" : "○"}</button>
            <span class="debugger-system__label">${escapeHtml(entry.label)}</span>
            <strong class="debugger-system__timing">${timing}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLog(sidebar: HTMLElement, state: DebugState) {
  const controls = sidebar.querySelector<HTMLElement>("[data-log-controls]");
  if (controls) {
    controls.innerHTML = ALL_LOG_CATEGORIES.map((cat) => {
      const active = state.logFilter.has(cat);
      return `<button class="debugger-log-chip${active ? " is-active" : ""}" data-log-toggle="${cat}">${cat}</button>`;
    }).join("") + `<button class="debugger-log-chip debugger-log-chip--pause${state.logPaused ? " is-active" : ""}" data-log-pause>${state.logPaused ? "resume" : "pause"}</button>`;
  }

  const host = sidebar.querySelector<HTMLElement>("[data-log]");
  if (!host) return;

  const visible = state.eventLog.filter((e) => state.logFilter.has(e.cat));
  if (visible.length === 0) {
    host.innerHTML = state.logPaused
      ? `<span class="debugger-log__empty">paused</span>`
      : `<span class="debugger-log__empty">no events</span>`;
    return;
  }

  host.innerHTML = visible
    .map((e) => `<div class="debugger-log__entry debugger-log__entry--${e.cat}">${escapeHtml(e.text)}${e.count > 1 ? `<span class="debugger-log__count">×${e.count}</span>` : ""}</div>`)
    .join("");
}

function renderPhysicsOverlay<TWorld extends DebuggerWorld>(
  world: TWorld,
  overlay: Graphics,
  labels: Map<number, Text>,
  selectedEntity: Entity | undefined,
  getEntityTitle: ((world: TWorld, entity: Entity) => string) | undefined,
  state?: DebugState,
  gridOptions?: Required<DebugGridOptions>,
  viewportW?: number,
  viewportH?: number,
  gameW?: number,
  gameH?: number,
) {
  overlay.clear();

  if (state?.showGrid && gridOptions) {
    renderWorldGrid(overlay, state.camera, gridOptions, viewportW, viewportH);
  }

  // game viewport indicator — shows what the game camera sees at normal 1:1 zoom
  if (gameW && gameH) {
    overlay.rect(0, 0, gameW, gameH).stroke({ color: 0x3f3f46, width: 1, alpha: 0.8 });
  }

  const liveEntities = new Set(world.entities);
  for (const [entity, label] of labels) {
    if (liveEntities.has(entity)) continue;
    label.destroy();
    labels.delete(entity);
  }

  if (!state?.showPhysics && !state?.showLabels && !state?.showSprites) return;

  for (const body of world.physics.getDebugBodies()) {
    const isSelected = body.entity === selectedEntity;
    const cx = body.x + body.width / 2;
    const cy = body.y + body.height / 2;

    if (state?.showPhysics) {
      const color = isSelected ? 0xf59e0b : colorForBodyKind(body.kind);
      overlay
        .rect(body.x, body.y, body.width, body.height)
        .stroke({ color, width: isSelected ? 2 : 1, alpha: 0.95 });

      // center dot
      overlay.circle(cx, cy, 2).fill({ color, alpha: 0.9 });

      // velocity arrow
      const rigidBody = world.physics.rigidBodies.get(body.entity);
      if (rigidBody) {
        const vx = rigidBody.body.velocity.x;
        const vy = rigidBody.body.velocity.y;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.1) {
          const scale = 30;
          const tx = cx + vx * scale;
          const ty = cy + vy * scale;
          const arrowColor = isSelected ? 0xf59e0b : 0xffffff;
          overlay.moveTo(cx, cy).lineTo(tx, ty).stroke({ color: arrowColor, width: 1.5, alpha: 0.85 });
          // arrowhead
          const angle = Math.atan2(vy, vx);
          const headLen = 5;
          overlay
            .moveTo(tx, ty)
            .lineTo(tx - headLen * Math.cos(angle - 0.5), ty - headLen * Math.sin(angle - 0.5))
            .stroke({ color: arrowColor, width: 1.5, alpha: 0.85 });
          overlay
            .moveTo(tx, ty)
            .lineTo(tx - headLen * Math.cos(angle + 0.5), ty - headLen * Math.sin(angle + 0.5))
            .stroke({ color: arrowColor, width: 1.5, alpha: 0.85 });
        }
      }
    }

    let label = labels.get(body.entity);
    if (!state?.showLabels) {
      if (label) label.visible = false;
    } else {
      if (!label) {
        label = new Text({
          text: getEntityTitle?.(world, body.entity) ?? entityTitle(world, body.entity),
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 },
          },
        });
        labels.set(body.entity, label);
        overlay.parent?.addChild(label);
      }
      label.position.set(body.x, body.y - 12);
      label.visible = true;
    }
  }

  // sprite bounds + anchor
  if (state?.showSprites) {
    for (const [entity, spriteRef] of sprites) {
      const t = transforms.get(entity);
      if (!t) continue;
      const { sprite, offset, anchor } = spriteRef;
      const scaleX = typeof t.scale === "number" ? t.scale : (t.scale?.x ?? 1);
      const scaleY = typeof t.scale === "number" ? t.scale : (t.scale?.y ?? 1);
      const w = sprite.texture.width * Math.abs(scaleX);
      const h = sprite.texture.height * Math.abs(scaleY);
      const posX = t.x + offset.x;
      const posY = t.y + offset.y;
      const bx = posX - (scaleX < 0 ? (1 - anchor.x) : anchor.x) * w;
      const by = posY - (scaleY < 0 ? (1 - anchor.y) : anchor.y) * h;
      // sprite bounds box
      overlay.rect(bx, by, w, h).stroke({ color: 0x06b6d4, width: 1, alpha: 0.7 });
      // anchor cross — always at sprite.position (the anchor point in Pixi)
      const ax = posX;
      const ay = posY;
      const cs = 4;
      overlay.moveTo(ax - cs, ay).lineTo(ax + cs, ay).stroke({ color: 0xfbbf24, width: 1.5, alpha: 0.9 });
      overlay.moveTo(ax, ay - cs).lineTo(ax, ay + cs).stroke({ color: 0xfbbf24, width: 1.5, alpha: 0.9 });
    }
  }
}

function renderWorldGrid(
  overlay: Graphics,
  camera: DebugState["camera"],
  options: Required<DebugGridOptions>,
  viewportWidth?: number,
  viewportHeight?: number,
) {
  if (!viewportWidth || !viewportHeight || camera.zoom <= 0) return;

  const worldLeft = -camera.x / camera.zoom;
  const worldTop = -camera.y / camera.zoom;
  const worldRight = (viewportWidth - camera.x) / camera.zoom;
  const worldBottom = (viewportHeight - camera.y) / camera.zoom;
  const worldLineWidth = 1 / camera.zoom;
  const minorStep = options.snapSize;
  const majorStep = minorStep * options.majorEvery;
  const minorScreenPx = minorStep * camera.zoom;
  const majorScreenPx = majorStep * camera.zoom;
  const minorAlpha = computeMinorAlpha(minorScreenPx, options);
  const majorAlpha = computeMajorAlpha(majorScreenPx);

  if (minorAlpha > 0) {
    drawGridLines(overlay, worldLeft, worldTop, worldRight, worldBottom, minorStep, {
      color: 0xc9ccd4,
      alpha: minorAlpha,
      width: worldLineWidth,
    }, majorStep);
  }

  drawGridLines(overlay, worldLeft, worldTop, worldRight, worldBottom, majorStep, {
    color: 0xd7dbe4,
    alpha: majorAlpha,
    width: worldLineWidth,
  });
}

function computeMinorAlpha(screenPx: number, options: Required<DebugGridOptions>) {
  if (screenPx <= options.minMinorScreenPx * 0.7) return 0;
  if (screenPx >= options.maxMinorScreenPx * 1.35) return 0.065;

  const t = clamp01((screenPx - options.minMinorScreenPx * 0.7) / (options.maxMinorScreenPx * 1.35 - options.minMinorScreenPx * 0.7));
  return lerp(0.045, 0.095, t);
}

function computeMajorAlpha(screenPx: number) {
  const t = clamp01((screenPx - 40) / 80);
  return lerp(0.085, 0.13, t);
}

function drawGridLines(
  overlay: Graphics,
  left: number,
  top: number,
  right: number,
  bottom: number,
  step: number,
  stroke: { color: number; alpha: number; width: number },
  skipEvery?: number,
) {
  if (step <= 0) return;

  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;

  for (let x = startX; x <= right; x += step) {
    if (skipEvery && isGridLineAligned(x, skipEvery)) continue;
    overlay.moveTo(x, top).lineTo(x, bottom).stroke(stroke);
  }

  for (let y = startY; y <= bottom; y += step) {
    if (skipEvery && isGridLineAligned(y, skipEvery)) continue;
    overlay.moveTo(left, y).lineTo(right, y).stroke(stroke);
  }
}

function isGridLineAligned(value: number, step: number) {
  const rounded = Math.round(value / step);
  return Math.abs(value - rounded * step) < 0.0001;
}

function resolveGridOptions(options?: DebugGridOptions): Required<DebugGridOptions> {
  return {
    snapSize: Math.max(1, Math.round(options?.snapSize ?? DEFAULT_GRID_OPTIONS.snapSize)),
    majorEvery: Math.max(2, Math.round(options?.majorEvery ?? DEFAULT_GRID_OPTIONS.majorEvery)),
    minMinorScreenPx: Math.max(4, options?.minMinorScreenPx ?? DEFAULT_GRID_OPTIONS.minMinorScreenPx),
    maxMinorScreenPx: Math.max(
      options?.minMinorScreenPx ?? DEFAULT_GRID_OPTIONS.minMinorScreenPx,
      options?.maxMinorScreenPx ?? DEFAULT_GRID_OPTIONS.maxMinorScreenPx,
    ),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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
    case "body:velocity":
      return { cat: "physics", text: `velocity ${entityLabel(world, event.entity, getEntityTitle)} ${event.velocity.x.toFixed(2)},${event.velocity.y.toFixed(2)}` };
    case "collision:start":
      return { cat: "collision", text: `collision start ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}` };
    case "collision:end":
      return { cat: "collision", text: `collision end ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}` };
  }
}

function renderRuntimeCard(title: string, fields: Array<{ label: string; value: string }>) {
  return `
    <div class="debugger-card">
      <div class="debugger-card__title">${title}</div>
      ${fields.map((field) => `<div class="debugger-field"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`).join("")}
    </div>
  `;
}

function renderCard(componentId: string, title: string, entity: Entity, fields: DebugEditorField[], collapsed = false) {
  return `
    <div class="debugger-card${collapsed ? " debugger-card--collapsed" : ""}">
      <div class="debugger-card__header">
        <span class="debugger-card__title">${escapeHtml(title)}</span>
        <button class="debugger-card__collapse" data-collapse-component="${escapeHtml(componentId)}">${collapsed ? "▸" : "▾"}</button>
      </div>
      ${collapsed ? "" : fields.map((field) => renderField(componentId, entity, field)).join("")}
    </div>
  `;
}

function renderField(componentId: string, entity: Entity, field: DebugEditorField) {
  if (field.editable && field.editKey) {
    return `
      <label class="debugger-field debugger-field--editable">
        <span>${escapeHtml(field.label)}</span>
        <input
          class="debugger-field__input"
          data-entity="${entity}"
          data-component="${escapeHtml(componentId)}"
          data-key="${escapeHtml(field.editKey)}"
          value="${escapeHtml(field.value)}"
        />
      </label>
    `;
  }

  if (field.selectEntities && field.selectEntities.length > 0) {
    return `
      <div class="debugger-field">
        <span>${escapeHtml(field.label)}</span>
        <div class="debugger-field__links">
          ${field.selectEntities.map((target) => `
            <button class="debugger-field__link" data-select-entity="${target}">#${target}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  if (field.selectEntity !== undefined) {
    return `
      <div class="debugger-field">
        <span>${escapeHtml(field.label)}</span>
        <div class="debugger-field__links">
          <button class="debugger-field__link" data-select-entity="${field.selectEntity}">#${field.selectEntity}</button>
        </div>
      </div>
    `;
  }

  return `<div class="debugger-field"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`;
}

function applyInspectorEdit<TWorld extends DebuggerWorld>(
  world: TWorld,
  components: Map<string, DebugInspectorComponent<TWorld>>,
  entity: Entity,
  componentId: string,
  key: string,
  rawValue: string,
) {
  components.get(componentId)?.set?.(world, entity, key, rawValue);
}

function setText(root: ParentNode, selector: string, value: string) {
  const node = root.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function syncPlayback(sidebar: HTMLElement, playbackState: "playing" | "paused" | "stopped", state: DebugState) {
  const playback = sidebar.querySelector<HTMLElement>(".debugger-toolbar__playback");
  if (playback) {
    playback.querySelector<HTMLButtonElement>("[data-action='play']")?.classList.toggle("is-active", playbackState === "playing");
    playback.querySelector<HTMLButtonElement>("[data-action='pause']")?.classList.toggle("is-active", playbackState === "paused");
    playback.querySelector<HTMLButtonElement>("[data-action='stop']")?.classList.toggle("is-active", playbackState === "stopped");
  }
  syncToggleState(sidebar, "grid", state.showGrid);
  syncToggleState(sidebar, "physics", state.showPhysics);
  syncToggleState(sidebar, "labels", state.showLabels);
  syncToggleState(sidebar, "sprites", state.showSprites);
  syncToggleState(sidebar, "camera-lock", state.lockTarget !== undefined);
}

function syncToggleState(root: HTMLElement, toggle: string, active: boolean) {
  const button = root.querySelector<HTMLButtonElement>(`[data-toggle="${toggle}"]`);
  button?.classList.toggle("is-active", active);
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

function applyCameraToStage(
  stage: Container,
  camera: { x: number; y: number; zoom: number },
) {
  stage.scale.set(camera.zoom);
  stage.position.set(camera.x, camera.y);
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

function normalizeScale(scale?: TransformScale) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}

function colorForBodyKind(kind: "dynamic" | "kinematic" | "static") {
  switch (kind) {
    case "dynamic":
      return 0x45d483;
    case "kinematic":
      return 0x4dabf7;
    case "static":
      return 0xa78bfa;
  }
}

function defaultRuntimeDetails(world: DebuggerWorld, entity: Entity) {
  const transform = transforms.get(entity);
  return [
    `entity=${entity}`,
    `tags=${world.tags.list(entity).join(",") || "-"}`,
    `x=${formatNumber(transform?.x)}`,
    `y=${formatNumber(transform?.y)}`,
  ].join(" | ");
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
