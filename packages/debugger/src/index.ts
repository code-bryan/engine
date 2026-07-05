import type { Entity, World, WorldDebugEvent } from "@engine/ecs-core";
import type { Physics, PhysicsDebugBody, PhysicsDebugEvent } from "@engine/physics";
import { transforms, type EngineApplication, type TransformScale } from "@engine/renderer";
import { Graphics, Text } from "pixi.js";

export type DebuggerWorld = World & { physics: Physics };

export type DebugEditorField = {
  label: string;
  value: string;
  secondary?: string;
};

export type DebugEditorSection<TWorld extends DebuggerWorld = DebuggerWorld> = {
  title: string;
  fields: DebugEditorField[] | ((world: TWorld, entity?: Entity) => DebugEditorField[]);
};

export type DebugInspectorComponent<TWorld extends DebuggerWorld = DebuggerWorld> = {
  id: string;
  title: string;
  fields: (world: TWorld, entity: Entity) => DebugEditorField[];
};

export type DebugStoreInspectorOptions<TValue, TWorld extends DebuggerWorld = DebuggerWorld> = {
  id: string;
  title: string;
  store: Map<Entity, TValue>;
  fields: (value: TValue, world: TWorld, entity: Entity) => DebugEditorField[];
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

export type RuntimeDebuggerOptions<TWorld extends DebuggerWorld = DebuggerWorld> = {
  getEntityTitle?: (world: TWorld, entity: Entity) => string;
  sections?: DebugEditorSection<TWorld>[];
  components?: DebugInspectorComponent<TWorld>[];
  getRuntimeDetails?: (world: TWorld, entity?: Entity) => string;
  playback?: DebugPlayback;
  trackedStores?: DebugTrackedStore[];
};

export type DebugEditor<TWorld extends DebuggerWorld = DebuggerWorld> = {
  world: TWorld;
  destroy: () => void;
};

type FrameMetric = {
  label: string;
  durationMs: number;
};

type DebugState = {
  selectedEntity?: Entity;
  latestFrame: number;
  latestDt: number;
  latestFrameMs: number;
  fps: number;
  systemMetrics: FrameMetric[];
  eventLog: string[];
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
    eventLog: [],
  };

  const componentInspectors = [
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

  const trackedStores = options.trackedStores ?? [];
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
      <div class="debugger-toolbar__brand">
        <div class="debugger-title">Runtime Debugger</div>
        <div class="debugger-subtitle">frame <span data-frame>0</span></div>
      </div>
      <div class="debugger-toolbar__actions">
        <div class="debugger-badge" data-playback>playing</div>
        <div class="debugger-controls debugger-controls--header">
          <button data-action="play" title="Play" aria-label="Play">
            <span aria-hidden="true">▶</span>
          </button>
          <button data-action="pause" title="Pause" aria-label="Pause">
            <span aria-hidden="true">Ⅱ</span>
          </button>
          <button data-action="step" title="Step" aria-label="Step">
            <span aria-hidden="true">▸|</span>
          </button>
          <button data-action="stop" title="Restart" aria-label="Restart">
            <span aria-hidden="true">↺</span>
          </button>
        </div>
      </div>
    </header>
    <aside class="debugger-panel debugger-panel--left">
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
      <section class="debugger-section debugger-section--grow">
        <div class="debugger-section__title">Inspector</div>
        <div class="debugger-inspector" data-inspector></div>
      </section>
    </aside>
    <section class="debugger-panel debugger-panel--bottom">
      <section class="debugger-section debugger-section--grow">
        <div class="debugger-section__title">Event Log</div>
        <pre class="debugger-log" data-log></pre>
      </section>
    </section>
  `;
  shell.appendChild(layout);

  const overlay = new Graphics();
  overlay.eventMode = "none";
  engine.app.stage.addChild(overlay);

  const searchInput = layout.querySelector<HTMLInputElement>("[data-search]");
  const controlsHost = layout.querySelector<HTMLElement>(".debugger-toolbar");

  const refresh = () => {
    recordStoreDiffs(world, trackedStores, storeSnapshots, state);
    renderDebugger(world, layout, viewportHud, overlay, labels, state, componentInspectors, options);
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
      case "system:run":
        state.systemMetrics.push({ label: event.label, durationMs: event.durationMs });
        break;
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

  const handleCanvasClick = (event: MouseEvent) => {
    state.selectedEntity = world.physics.pickEntityAt(toCanvasPoint(engine.app.canvas, event.clientX, event.clientY));
    refresh();
  };

  const handleControlsClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "play") options.playback?.onPlay?.();
    if (action === "pause") options.playback?.onPause?.();
    if (action === "step") options.playback?.onStep?.();
    if (action === "stop") options.playback?.onStop?.();
    syncPlayback(layout, options.playback?.getState?.() ?? "playing");
  };

  const handleSearchInput = () => {
    renderEntityList(world, layout, state.selectedEntity, options.getEntityTitle);
  };

  engine.app.canvas.addEventListener("click", handleCanvasClick);
  controlsHost?.addEventListener("click", handleControlsClick);
  searchInput?.addEventListener("input", handleSearchInput);

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
      engine.app.canvas.removeEventListener("click", handleCanvasClick);
      controlsHost?.removeEventListener("click", handleControlsClick);
      searchInput?.removeEventListener("input", handleSearchInput);
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
      position: relative;
      grid-template-columns: minmax(240px, 280px) minmax(320px, 1fr) minmax(260px, 320px);
      grid-template-rows: auto minmax(0, 1fr) minmax(96px, 18vh);
      grid-template-areas:
        "top top top"
        "left center right"
        "bottom bottom bottom";
      align-items: center;
      justify-items: stretch;
      column-gap: 18px;
      row-gap: 18px;
      padding: 20px;
      isolation: isolate;
    }
    .app-shell--debug::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
        linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
      background-size: 16px 16px, 16px 16px, 64px 64px, 64px 64px;
      background-position: 0 0, 0 0, 0 0, 0 0;
    }
    .app-shell--debug .game-frame {
      grid-area: center;
      justify-self: center;
      align-self: center;
      width: min(100%, calc((100vh - 220px) * 16 / 9));
      max-width: 1100px;
      position: relative;
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
      display: contents;
    }
    .debugger-toolbar {
      grid-area: top;
      position: relative;
      z-index: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    .debugger-toolbar__brand,
    .debugger-toolbar__actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .debugger-toolbar__brand {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
    .debugger-panel {
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
      grid-template-rows: minmax(0, 1fr);
      height: min(100%, 900px);
    }
    .debugger-panel--right {
      grid-area: right;
      grid-template-rows: minmax(220px, 42%) minmax(0, 1fr);
      height: min(100%, 900px);
    }
    .debugger-panel--bottom {
      grid-area: bottom;
      grid-template-rows: minmax(0, 1fr);
      min-height: 0;
      max-height: 160px;
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
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .debugger-controls--header {
      grid-template-columns: repeat(4, 32px);
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
      border-color: rgba(96, 165, 250, 0.6);
      background: rgba(30, 41, 59, 0.9);
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
    .debugger-card__title {
      margin-bottom: 6px;
      color: #fafafa;
      font-weight: 700;
    }
    .debugger-field {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #a1a1aa;
    }
    .debugger-field strong {
      color: #fafafa;
      text-align: right;
    }
    .debugger-log {
      margin: 0;
      min-height: 0;
      overflow: auto;
      white-space: pre-wrap;
      color: #d4d4d8;
      font-size: 11px;
      line-height: 1.3;
    }
    @media (max-width: 960px) {
      .app-shell--debug {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto auto auto;
        grid-template-areas:
          "top"
          "center"
          "left"
          "right"
          "bottom";
        align-items: stretch;
      }
      .app-shell--debug .game-frame {
        width: min(100%, calc((100vh - 24px) * 16 / 9));
      }
      .debugger-panel--left,
      .debugger-panel--right {
        height: auto;
      }
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
) {
  renderOverview(sidebar, viewportHud, state, options.playback?.getState?.() ?? "playing");
  renderEntityList(world, sidebar, state.selectedEntity, options.getEntityTitle);
  renderInspector(world, sidebar, state.selectedEntity, components, options);
  renderSystems(sidebar, state.systemMetrics);
  renderLog(sidebar, state.eventLog);
  renderPhysicsOverlay(world, overlay, labels, state.selectedEntity, options.getEntityTitle);
}

function renderOverview(
  sidebar: HTMLElement,
  viewportHud: HTMLElement,
  state: DebugState,
  playbackState: "playing" | "paused" | "stopped",
) {
  setText(sidebar, "[data-frame]", String(state.latestFrame));
  setText(viewportHud, "[data-fps]", state.fps.toFixed(1));
  setText(viewportHud, "[data-frame-ms]", state.latestFrameMs.toFixed(2));
  syncPlayback(sidebar, playbackState);
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
) {
  const host = sidebar.querySelector<HTMLElement>("[data-inspector]");
  if (!host) return;

  if (entity === undefined) {
    host.innerHTML = "";
    return;
  }

  const transform = transforms.get(entity);
  const scale = normalizeScale(transform?.scale);
  const body = world.physics.getDebugBodies().find((item) => item.entity === entity);
  const cards: string[] = [
    renderCard("Entity", [
      { label: "Name", value: options.getEntityTitle?.(world, entity) ?? entityTitle(world, entity) },
      { label: "Tags", value: world.tags.list(entity).join(", ") || "-" },
    ]),
    renderCard("Transform", [
      { label: "X", value: formatNumber(transform?.x) },
      { label: "Y", value: formatNumber(transform?.y) },
      { label: "Scale", value: `${formatNumber(scale.x)}, ${formatNumber(scale.y)}` },
      { label: "Rot", value: formatNumber(transform?.rotation) },
    ]),
    renderCard("Physics", [
      { label: "Kind", value: body?.kind ?? "-" },
      { label: "Bounds", value: body ? `${formatNumber(body.width)} x ${formatNumber(body.height)}` : "-" },
      { label: "Colliding", value: body?.isColliding ? "yes" : "no" },
    ]),
  ];

  for (const component of components) {
    const fields = component.fields(world, entity);
    if (fields.length === 0) continue;
    cards.push(renderCard(component.title, fields.map((field) => ({
      label: field.label,
      value: field.secondary === undefined ? field.value : `${field.value}, ${field.secondary}`,
    }))));
  }

  cards.push(renderCard("Runtime", [
    { label: "Details", value: options.getRuntimeDetails?.(world, entity) ?? defaultRuntimeDetails(world, entity) },
  ]));

  host.innerHTML = cards.join("");
}

function renderSystems(sidebar: HTMLElement, metrics: FrameMetric[]) {
  const host = sidebar.querySelector<HTMLElement>("[data-systems]");
  if (!host) return;

  host.innerHTML = metrics.length === 0
    ? `<div class="debugger-card"><div class="debugger-field"><span>systems</span><strong>waiting for frame</strong></div></div>`
    : metrics
        .map((metric) => `
          <div class="debugger-card">
            <div class="debugger-field"><span>${metric.label}</span><strong>${metric.durationMs.toFixed(2)} ms</strong></div>
          </div>
        `)
        .join("");
}

function renderLog(sidebar: HTMLElement, entries: string[]) {
  setText(sidebar, "[data-log]", entries.join("\n"));
}

function renderPhysicsOverlay<TWorld extends DebuggerWorld>(
  world: TWorld,
  overlay: Graphics,
  labels: Map<number, Text>,
  selectedEntity: Entity | undefined,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
) {
  overlay.clear();

  const liveEntities = new Set(world.entities);
  for (const [entity, label] of labels) {
    if (liveEntities.has(entity)) continue;
    label.destroy();
    labels.delete(entity);
  }

  for (const body of world.physics.getDebugBodies()) {
    const color = body.entity === selectedEntity ? 0xf59e0b : colorForBodyKind(body.kind);
    overlay
      .rect(body.x, body.y, body.width, body.height)
      .stroke({ color, width: body.entity === selectedEntity ? 2 : 1, alpha: 0.95 });

    let label = labels.get(body.entity);
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
        if (snapshots.has(key)) pushLog(state, `frame ${world.getFrame()} ${tracked.label}[${entity}] ${snapshot}`);
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
) {
  switch (event.type) {
    case "entity:spawn":
      return `frame ${event.frame} spawn ${entityLabel(world, event.entity, getEntityTitle)}`;
    case "entity:destroy":
      return `frame ${event.frame} destroy ${entityLabel(world, event.entity, getEntityTitle)}`;
    case "tag:add":
      return `frame ${event.frame} tag+ ${entityLabel(world, event.entity, getEntityTitle)} ${event.tag}`;
    case "tag:remove":
      return `frame ${event.frame} tag- ${entityLabel(world, event.entity, getEntityTitle)} ${event.tag}`;
    case "system:add":
      return `frame ${event.frame} system ${event.index} ${event.label}`;
    default:
      return "";
  }
}

function formatPhysicsEvent<TWorld extends DebuggerWorld>(
  world: TWorld,
  event: PhysicsDebugEvent,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
) {
  switch (event.type) {
    case "body:set":
      return `body set ${entityLabel(world, event.entity, getEntityTitle)} ${event.kind} ${event.width}x${event.height} @ ${event.x},${event.y}`;
    case "body:reset":
      return `body reset ${entityLabel(world, event.entity, getEntityTitle)} @ ${event.x},${event.y}`;
    case "body:velocity":
      return `velocity ${entityLabel(world, event.entity, getEntityTitle)} ${event.velocity.x.toFixed(2)},${event.velocity.y.toFixed(2)}`;
    case "collision:start":
      return `collision start ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}`;
    case "collision:end":
      return `collision end ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}`;
  }
}

function renderCard(title: string, fields: Array<{ label: string; value: string }>) {
  return `
    <div class="debugger-card">
      <div class="debugger-card__title">${title}</div>
      ${fields.map((field) => `<div class="debugger-field"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`).join("")}
    </div>
  `;
}

function setText(root: ParentNode, selector: string, value: string) {
  const node = root.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function syncPlayback(sidebar: HTMLElement, playbackState: "playing" | "paused" | "stopped") {
  setText(sidebar, "[data-playback]", playbackState);
}

function pushLog(state: DebugState, message: string) {
  if (!message) return;
  state.eventLog.unshift(message);
  state.eventLog = state.eventLog.slice(0, 80);
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
