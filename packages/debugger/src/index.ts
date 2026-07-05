import type { Entity, World } from "@engine/ecs-core";
import type { Physics, PhysicsDebugBody } from "@engine/physics";
import { transforms, type EngineApplication, type TransformScale } from "@engine/renderer";
import { Graphics, Text } from "pixi.js";

export type DebuggerWorld = World & { physics: Physics };

type DebugControls = {
  enabled: boolean;
  showBodies: boolean;
  showLabels: boolean;
  showGrid: boolean;
  snap: boolean;
  mode: "select" | "place" | "move" | "erase";
  selectedEntity?: number;
};

export type DebugEditorField = {
  label: string;
  value: string;
  secondary?: string;
};

export type DebugEditorSection<TWorld extends DebuggerWorld = DebuggerWorld> = {
  title: string;
  fields: DebugEditorField[] | ((world: TWorld, entity?: Entity) => DebugEditorField[]);
};

export type RuntimeDebuggerOptions<TWorld extends DebuggerWorld = DebuggerWorld> = {
  getEntityTitle?: (world: TWorld, entity: Entity) => string;
  sections?: DebugEditorSection<TWorld>[];
  getRuntimeDetails?: (world: TWorld, entity?: Entity) => string;
  playback?: {
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onStep?: () => void;
    getState?: () => "playing" | "paused" | "stopped";
  };
};

export type DebugEditor<TWorld extends DebuggerWorld = DebuggerWorld> = {
  controls: DebugControls;
  world: TWorld;
  destroy: () => void;
};

export function attachRuntimeDebugger<TWorld extends DebuggerWorld>(
  world: TWorld,
  engine: EngineApplication,
  options: RuntimeDebuggerOptions<TWorld> = {},
): DebugEditor<TWorld> {
  const controls: DebugControls = {
    enabled: true,
    showBodies: true,
    showLabels: true,
    showGrid: true,
    snap: true,
    mode: "select",
    selectedEntity: undefined,
  };

  const shell = document.querySelector(".app-shell");
  if (!(shell instanceof HTMLElement)) throw new Error("app shell not found");

  const sidebar = document.createElement("aside");
  sidebar.className = "editor-sidebar";
  sidebar.innerHTML = `
    <div class="editor-session">
      <div class="editor-session__head">
        <div class="editor-session__file">nivel_01.json<span class="editor-session__dirty">*</span></div>
        <div class="editor-badge">Modo Diseno</div>
      </div>
      <div class="editor-session__actions">
        <button class="editor-play">Jugar</button>
        <button class="editor-mini-btn" title="Pausar">II</button>
        <button class="editor-mini-btn" title="Paso">></button>
        <button class="editor-mini-btn editor-mini-btn--stop" title="Detener">[]</button>
      </div>
    </div>

    <section class="editor-section">
      <button class="editor-section__header" data-section-toggle="hierarchy">
        <span>Jerarquia</span>
        <span class="editor-section__meta" data-entities-count>0 Ent</span>
      </button>
      <div class="editor-section__body" data-section="hierarchy">
        <div class="editor-search-row">
          <input class="editor-input" data-hierarchy-search placeholder="Buscar entidades..." />
        </div>
        <div class="editor-hierarchy" data-hierarchy-list></div>
      </div>
    </section>

    <section class="editor-section editor-section--grow">
      <button class="editor-section__header" data-section-toggle="inspector">
        <span>Inspector</span>
      </button>
      <div class="editor-section__body editor-inspector" data-section="inspector">
        <div class="editor-entity-head">
          <input class="editor-input editor-input--title" data-entity-name value="Sin seleccion" readonly />
          <div class="editor-row">
            <label class="editor-prop">
              <span class="editor-prop__label">Tags</span>
              <input class="editor-input" data-entity-tags value="-" readonly />
            </label>
            <label class="editor-prop">
              <span class="editor-prop__label">Tipo</span>
              <input class="editor-input" data-entity-kind value="-" readonly />
            </label>
          </div>
        </div>

        <div class="editor-component">
          <div class="editor-component__title">Transformacion</div>
          <div class="editor-prop">
            <span class="editor-prop__label">Posicion</span>
            <div class="editor-vector">
              <input class="editor-input" data-transform-x readonly />
              <input class="editor-input" data-transform-y readonly />
            </div>
          </div>
          <div class="editor-prop">
            <span class="editor-prop__label">Escala</span>
            <div class="editor-vector">
              <input class="editor-input" data-scale-x readonly />
              <input class="editor-input" data-scale-y readonly />
            </div>
          </div>
          <div class="editor-prop">
            <span class="editor-prop__label">Rotacion</span>
            <input class="editor-input" data-rotation readonly />
          </div>
        </div>

        <div class="editor-component">
          <div class="editor-component__title">PhysicsBody2D</div>
          <div class="editor-prop">
            <span class="editor-prop__label">Cuerpo</span>
            <input class="editor-input" data-body-kind readonly />
          </div>
          <div class="editor-prop">
            <span class="editor-prop__label">Bounds</span>
            <div class="editor-vector">
              <input class="editor-input" data-body-width readonly />
              <input class="editor-input" data-body-height readonly />
            </div>
          </div>
        </div>

        <div data-extra-sections></div>

        <div class="editor-component">
          <div class="editor-component__title">Runtime</div>
          <pre class="editor-runtime" data-runtime-details></pre>
        </div>
      </div>
    </section>

    <footer class="editor-footer">
      <span>Status</span>
      <div class="editor-footer__stats">
        <span data-footer-entities>Ents: 0</span>
        <span data-footer-collisions>Cols: 0</span>
      </div>
    </footer>
  `;
  shell.appendChild(sidebar);

  const viewportChrome = createViewportChrome();
  const viewportHost = document.querySelector(".game-frame");
  if (!(viewportHost instanceof HTMLElement)) throw new Error("game frame not found");
  viewportHost.prepend(viewportChrome.toolbar);
  viewportHost.append(viewportChrome.footer);
  viewportHost.append(viewportChrome.stats);
  viewportHost.append(viewportChrome.grid);

  const overlay = new Graphics();
  overlay.eventMode = "none";
  engine.app.stage.addChild(overlay);

  const labels = new Map<number, Text>();
  let fps = 60;
  let ms = 16.7;
  let lastFrameAt = performance.now();

  bindSectionToggles(sidebar);
  bindToolbar(viewportChrome.toolbar, controls);

  const onCanvasClick = (event: MouseEvent) => {
    if (!controls.enabled || controls.mode !== "select") return;
    const point = toCanvasPoint(engine.app.canvas, event.clientX, event.clientY);
    controls.selectedEntity = world.physics.pickEntityAt(point);
    renderHierarchy(world, sidebar, controls.selectedEntity, options.getEntityTitle);
  };
  engine.app.canvas.addEventListener("click", onCanvasClick);

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Backquote") {
      controls.enabled = !controls.enabled;
      syncToggleState(viewportChrome.toolbar, "enabled", controls.enabled);
      return;
    }
    if (event.code === "KeyV") controls.mode = "select";
    if (event.code === "KeyB") controls.mode = "place";
    if (event.code === "KeyM") controls.mode = "move";
    if (event.code === "Delete") controls.mode = "erase";
    syncModeState(viewportChrome.toolbar, controls.mode);
  };
  window.addEventListener("keydown", onWindowKeyDown);

  const onSidebarClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest<HTMLElement>("[data-entity-row]");
    if (!row) return;
    controls.selectedEntity = Number(row.dataset.entityRow);
    renderHierarchy(world, sidebar, controls.selectedEntity, options.getEntityTitle);
    updateInspector(world, sidebar, controls.selectedEntity, options);
  };
  sidebar.addEventListener("click", onSidebarClick);

  bindPlayback(sidebar, options.playback);

  world.addSystem(() => {
    const now = performance.now();
    ms = now - lastFrameAt;
    fps = ms > 0 ? 1000 / ms : 60;
    lastFrameAt = now;

    viewportChrome.grid.style.display = controls.showGrid && controls.enabled ? "block" : "none";
    overlay.visible = controls.enabled;
    sidebar.dataset.enabled = String(controls.enabled);

    if (!controls.enabled) {
      overlay.clear();
      for (const label of labels.values()) label.visible = false;
      updateViewportStats(viewportChrome.stats, fps, ms);
      updateViewportFooter(viewportChrome.footer, controls);
      return;
    }

    overlay.clear();

    const debugBodies = world.physics.getDebugBodies();
    const activeEntities = new Set(debugBodies.map((body) => body.entity));

    renderHierarchy(world, sidebar, controls.selectedEntity, options.getEntityTitle);
    updateInspector(world, sidebar, controls.selectedEntity, options);
    updateViewportStats(viewportChrome.stats, fps, ms);
    updateViewportFooter(viewportChrome.footer, controls, controls.selectedEntity);
    updateSidebarFooter(sidebar, debugBodies.length, countCollisions(debugBodies));
    updatePlaybackState(sidebar, options.playback?.getState?.() ?? "playing");

    for (const body of debugBodies) {
      if (controls.showBodies) {
        overlay.rect(body.x, body.y, body.width, body.height);
        overlay.stroke({
          width: body.entity === controls.selectedEntity ? 2 : 1,
          color: body.entity === controls.selectedEntity ? 0xffdd57 : body.isColliding ? 0xff5c5c : colorForBodyKind(body.kind),
          alpha: 1,
        });
      }

      let label = labels.get(body.entity);
      if (!label) {
        label = new Text({
          text: "",
          style: {
            fill: 0xffffff,
            fontSize: 10,
          },
        });
        label.eventMode = "none";
        labels.set(body.entity, label);
        engine.app.stage.addChild(label);
      }

      label.visible = controls.showLabels;
      if (controls.showLabels) {
        label.text = `#${body.entity} ${world.tags.list(body.entity).join(",")}`;
        label.position.set(body.x, Math.max(0, body.y - 12));
      }
    }

    for (const [entity, label] of labels) {
      if (!activeEntities.has(entity)) label.visible = false;
    }
  });

  return {
    controls,
    world,
    destroy() {
      engine.app.canvas.removeEventListener("click", onCanvasClick);
      window.removeEventListener("keydown", onWindowKeyDown);
      sidebar.removeEventListener("click", onSidebarClick);
      overlay.destroy();
      for (const label of labels.values()) label.destroy();
      viewportChrome.toolbar.remove();
      viewportChrome.footer.remove();
      viewportChrome.stats.remove();
      viewportChrome.grid.remove();
      sidebar.remove();
    },
  };
}

function createViewportChrome() {
  const toolbar = document.createElement("header");
  toolbar.className = "viewport-toolbar";
  toolbar.innerHTML = `
    <div class="viewport-toolbar__group">
      <button class="viewport-btn" title="Cargar nivel">Open</button>
      <button class="viewport-btn" title="Guardar nivel">Save</button>
    </div>
    <div class="viewport-toolbar__group" data-tool-group="mode">
      <button class="viewport-btn viewport-btn--active" data-mode="select" title="Seleccionar">Sel</button>
      <button class="viewport-btn" data-mode="place" title="Colocar">Add</button>
      <button class="viewport-btn" data-mode="move" title="Mover">Move</button>
      <button class="viewport-btn viewport-btn--danger" data-mode="erase" title="Borrar">Del</button>
    </div>
    <div class="viewport-toolbar__group">
      <button class="viewport-btn viewport-btn--toggle viewport-btn--active" data-toggle="showGrid" title="Grid">Grid</button>
      <button class="viewport-btn viewport-btn--toggle viewport-btn--active" data-toggle="snap" title="Snap">Snap</button>
      <button class="viewport-btn viewport-btn--toggle viewport-btn--active" data-toggle="showBodies" title="Bodies">Body</button>
      <button class="viewport-btn viewport-btn--toggle viewport-btn--active" data-toggle="showLabels" title="Labels">Tags</button>
      <button class="viewport-btn viewport-btn--toggle viewport-btn--active" data-toggle="enabled" title="Debug">Debug</button>
    </div>
    <div class="viewport-toolbar__brand">Pixi.js Editor</div>
  `;

  const stats = document.createElement("div");
  stats.className = "viewport-stats";

  const grid = document.createElement("div");
  grid.className = "viewport-grid";

  const footer = document.createElement("footer");
  footer.className = "viewport-footer";

  return { toolbar, stats, grid, footer };
}

function bindSectionToggles(sidebar: HTMLElement) {
  for (const button of sidebar.querySelectorAll<HTMLElement>("[data-section-toggle]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.sectionToggle;
      if (!key) return;
      const body = sidebar.querySelector<HTMLElement>(`[data-section="${key}"]`);
      body?.classList.toggle("is-collapsed");
    });
  }
}

function bindToolbar(toolbar: HTMLElement, controls: DebugControls) {
  toolbar.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>("button");
    if (!button) return;

    const mode = button.dataset.mode as DebugControls["mode"] | undefined;
    if (mode) {
      controls.mode = mode;
      syncModeState(toolbar, mode);
      return;
    }

    const toggle = button.dataset.toggle as keyof DebugControls | undefined;
    if (!toggle) return;

    const next = !controls[toggle] as boolean;
    (controls[toggle] as boolean) = next;
    syncToggleState(toolbar, toggle, next);
  });
}

function bindPlayback(
  sidebar: HTMLElement,
  playback?: RuntimeDebuggerOptions["playback"],
) {
  if (!playback) return;
  const buttons = sidebar.querySelectorAll<HTMLButtonElement>(".editor-session__actions button");
  const [play, pause, step, stop] = buttons;
  play?.addEventListener("click", () => playback.onPlay?.());
  pause?.addEventListener("click", () => playback.onPause?.());
  step?.addEventListener("click", () => playback.onStep?.());
  stop?.addEventListener("click", () => playback.onStop?.());
}

function syncModeState(toolbar: HTMLElement, mode: DebugControls["mode"]) {
  for (const button of toolbar.querySelectorAll<HTMLElement>("[data-mode]")) {
    button.classList.toggle("viewport-btn--active", button.dataset.mode === mode);
  }
}

function syncToggleState(toolbar: HTMLElement, toggle: string, active: boolean) {
  const button = toolbar.querySelector<HTMLElement>(`[data-toggle="${toggle}"]`);
  button?.classList.toggle("viewport-btn--active", active);
}

function renderHierarchy<TWorld extends DebuggerWorld>(
  world: TWorld,
  sidebar: HTMLElement,
  selectedEntity?: number,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
) {
  const list = sidebar.querySelector<HTMLElement>("[data-hierarchy-list]");
  const search = sidebar.querySelector<HTMLInputElement>("[data-hierarchy-search]");
  const count = sidebar.querySelector<HTMLElement>("[data-entities-count]");
  if (!list || !search || !count) return;

  const query = search.value.trim().toLowerCase();
  const rows: string[] = [];

  for (const entity of world.entities) {
    const tags = world.tags.list(entity);
    const title = getEntityTitle?.(world, entity) ?? entityTitle(tags, entity);
    const summary = `${title} ${tags.join(" ")} ${entity}`.toLowerCase();
    if (query && !summary.includes(query)) continue;

    rows.push(`
      <button class="hierarchy-row${entity === selectedEntity ? " hierarchy-row--active" : ""}" data-entity-row="${entity}">
        <span class="hierarchy-row__name">${title}</span>
        <span class="hierarchy-row__meta">${tags[0] ?? "entity"}</span>
      </button>
    `);
  }

  list.innerHTML = rows.join("");
  count.textContent = `${world.entities.size} Ent`;
}

function updateInspector<TWorld extends DebuggerWorld>(
  world: TWorld,
  sidebar: HTMLElement,
  entity: Entity | undefined,
  options: RuntimeDebuggerOptions<TWorld>,
) {
  const set = (selector: string, value: string) => {
    const input = sidebar.querySelector<HTMLInputElement | HTMLPreElement>(selector);
    if (!input) return;
    if (input instanceof HTMLPreElement) input.textContent = value;
    else input.value = value;
  };

  const extraSections = sidebar.querySelector<HTMLElement>("[data-extra-sections]");
  if (!extraSections) return;

  if (entity === undefined) {
    set("[data-entity-name]", "Sin seleccion");
    set("[data-entity-tags]", "-");
    set("[data-entity-kind]", "-");
    set("[data-transform-x]", "-");
    set("[data-transform-y]", "-");
    set("[data-scale-x]", "-");
    set("[data-scale-y]", "-");
    set("[data-rotation]", "-");
    set("[data-body-kind]", "-");
    set("[data-body-width]", "-");
    set("[data-body-height]", "-");
    set("[data-runtime-details]", options.getRuntimeDetails?.(world) ?? "selection: none");
    extraSections.innerHTML = "";
    return;
  }

  const transform = transforms.get(entity);
  const body = world.physics.getDebugBodies().find((item) => item.entity === entity);
  const scale = normalizeScale(transform?.scale);

  set("[data-entity-name]", options.getEntityTitle?.(world, entity) ?? entityTitle(world.tags.list(entity), entity));
  set("[data-entity-tags]", world.tags.list(entity).join(", ") || "-");
  set("[data-entity-kind]", body?.kind ?? "-");
  set("[data-transform-x]", formatNumber(transform?.x));
  set("[data-transform-y]", formatNumber(transform?.y));
  set("[data-scale-x]", formatNumber(scale.x));
  set("[data-scale-y]", formatNumber(scale.y));
  set("[data-rotation]", formatNumber(transform?.rotation));
  set("[data-body-kind]", body?.kind ?? "-");
  set("[data-body-width]", formatNumber(body?.width));
  set("[data-body-height]", formatNumber(body?.height));
  set("[data-runtime-details]", options.getRuntimeDetails?.(world, entity) ?? defaultRuntimeDetails(world, entity));

  extraSections.innerHTML = (options.sections ?? [])
    .map((section) => {
      const fields = typeof section.fields === "function" ? section.fields(world, entity) : section.fields;
      return `
        <div class="editor-component">
          <div class="editor-component__title">${section.title}</div>
          ${fields.map((field) => `
            <div class="editor-prop">
              <span class="editor-prop__label">${field.label}</span>
              ${field.secondary !== undefined
                ? `<div class="editor-vector"><input class="editor-input" value="${field.value}" readonly /><input class="editor-input" value="${field.secondary}" readonly /></div>`
                : `<input class="editor-input" value="${field.value}" readonly />`}
            </div>
          `).join("")}
        </div>
      `;
    })
    .join("");
}

function updateViewportStats(stats: HTMLElement, fps: number, ms: number) {
  stats.innerHTML = `
    <span><b>FPS</b> ${Math.round(fps)}</span>
    <span><b>MS</b> ${ms.toFixed(1)}</span>
  `;
}

function updateViewportFooter(footer: HTMLElement, controls: DebugControls, selectedEntity?: number) {
  footer.innerHTML = `
    <span>Tool: ${controls.mode}</span>
    <span>Snap: ${controls.snap ? "16x16" : "off"}</span>
    <span>Grid: ${controls.showGrid ? "on" : "off"}</span>
    <span>Selected: ${selectedEntity ?? "-"}</span>
  `;
}

function updateSidebarFooter(sidebar: HTMLElement, entities: number, collisions: number) {
  const footerEntities = sidebar.querySelector<HTMLElement>("[data-footer-entities]");
  const footerCollisions = sidebar.querySelector<HTMLElement>("[data-footer-collisions]");
  if (footerEntities) footerEntities.textContent = `Ents: ${entities}`;
  if (footerCollisions) footerCollisions.textContent = `Cols: ${collisions}`;
}

function updatePlaybackState(sidebar: HTMLElement, state: "playing" | "paused" | "stopped") {
  const badge = sidebar.querySelector<HTMLElement>(".editor-badge");
  if (!badge) return;
  badge.textContent = state === "playing" ? "Jugando" : state === "paused" ? "Pausado" : "Modo Diseno";
}

function entityTitle(tags: string[], entity: number) {
  const tag = tags[0] ?? "entity";
  return `${capitalize(tag)}_${entity}`;
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function countCollisions(bodies: PhysicsDebugBody[]) {
  return bodies.filter((body) => body.isColliding).length;
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
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

function defaultRuntimeDetails(world: DebuggerWorld, entity?: number) {
  if (entity === undefined) return "selection: none";
  const transform = transforms.get(entity);
  const body = world.physics.getDebugBodies().find((item) => item.entity === entity);
  return [
    `entity: ${entity}`,
    `tags: ${world.tags.list(entity).join(", ") || "-"}`,
    `transform: ${formatNumber(transform?.x)}, ${formatNumber(transform?.y)} rot=${formatNumber(transform?.rotation)}`,
    `body: ${body ? `${body.kind} ${body.width}x${body.height}` : "-"}`,
  ].join("\n");
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

function normalizeScale(scale?: TransformScale) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}
