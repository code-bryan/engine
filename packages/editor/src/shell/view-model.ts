// Maps the editor's DebugState (+ world + options) into the flat prop object the
// EditorShell renders, and re-renders the React root. The builder functions turn
// live ECS/runtime data into plain view-model values (see also
// features/inspector/cards for the inspector cards). Adapted from the original
// view-models module (renderDebuggerUi -> renderEditor, DebuggerUi -> EditorShell).

import type { Entity } from "@engine/ecs-core";
import { createElement } from "react";
import type { Root } from "react-dom/client";
import { EditorShell } from "./EditorShell";
import type {
  DebuggerEntityItemView,
  DebuggerFieldView,
  DebuggerLogEntryView,
  DebuggerSnapshotView,
  DebuggerStatusCardView,
  DebuggerSystemView,
} from "./view-types";
import { buildInspectorCards } from "../features/inspector/cards";
import type {
  DebugInspectorComponent,
  DebugState,
  DebugStatusPanel,
  EditorToolMode,
  DebuggerWorld,
  FrameMetric,
  LogCategory,
  RuntimeDebuggerOptions,
} from "../shared/types";

export type EditorUiActions = {
  toggleDebugMenu: () => void;
  closeMenus: () => void;
  toggleGrid: () => void;
  togglePhysics: () => void;
  toggleLabels: () => void;
  toggleSprites: () => void;
  toggleCameraLock: () => void;
  setToolMode: (mode: EditorToolMode) => void;
  playback: (action: "play" | "pause" | "step" | "stop") => void;
  zoom: (action: "zoom-in" | "zoom-out" | "zoom-100" | "zoom-fit" | "camera-reset") => void;
  setZoomSensitivity: (value: number) => void;
  setEntityQuery: (value: string) => void;
  setInspectorQuery: (value: string) => void;
  selectEntity: (entity: number) => void;
  toggleComponentCollapse: (id: string) => void;
  editInspector: (entity: number, componentId: string, key: string, value: string) => void;
  saveSnapshot: () => void;
  restoreSnapshot: (index: number) => void;
  toggleSystem: (index: number) => void;
  toggleLogFilter: (cat: string) => void;
  toggleLogPause: () => void;
  toggleGridSnap: () => void;
  setGridSnapSize: (value: number) => void;
  calcGridSnapSize: () => void;
  toggleRotationSnap: () => void;
  setRotationSnapDeg: (value: number) => void;
  openDoc: (path: string, kind: "graph" | "component") => void;
  closeDoc: (path: string) => void;
  selectDoc: (path: string) => void;
  openWorld: (path: string) => void;
  selectWorld: (path: string) => void;
  closeWorld: (path: string) => void;
  selectScene: () => void;
  addSystem: (name: string) => void;
  removeSystem: (name: string) => void;
  openLevel: () => void;
  toggleContentDrawer: () => void;
  loadWorld: (name: string) => void;
  openProject: (path: string) => void;
  createProject: (path: string) => void;
  closeProject: () => void;
  browseProject: (mode: "open" | "create") => Promise<string | null>;
  dismissToast: (id: number) => void;
  save: () => void;
};

export function renderEditor<TWorld extends DebuggerWorld>(
  root: Root,
  world: TWorld,
  state: DebugState,
  components: DebugInspectorComponent<TWorld>[],
  options: RuntimeDebuggerOptions<TWorld>,
  actions: EditorUiActions,
  logCategories: readonly LogCategory[],
) {
  root.render(createElement(EditorShell, {
    fps: state.fps.toFixed(1),
    frameMs: state.latestFrameMs.toFixed(2),
    playbackState: options.playback?.getState?.() ?? "playing",
    zoomLabel: `${state.camera.zoom.toFixed(2)}x`,
    showGrid: state.showGrid,
    showPhysics: state.showPhysics,
    showLabels: state.showLabels,
    showSprites: state.showSprites,
    cameraZoomSensitivity: state.cameraZoomSensitivity,
    cameraLocked: state.lockTarget !== undefined,
    debugMenuOpen: state.openDropdown === "debug",
    toolMode: state.toolMode,
    snapGrid: state.snapGrid,
    snapGridSize: state.snapGridSize,
    snapRotate: state.snapRotate,
    snapRotateDeg: state.snapRotateDeg,
    entityQuery: state.entityQuery,
    inspectorQuery: state.inspectorQuery,
    statusCards: buildStatusCards(world, options.statusPanels ?? []),
    entities: buildEntityItems(world, state, options.getEntityTitle),
    inspectorCards: buildInspectorCards(world, state, components, options),
    snapshots: buildSnapshotViews(state),
    systems: buildSystemViews(world, state.systemMetrics, state.systemTimingHistory, options.activeSystems ?? []),
    logs: buildLogEntries(state),
    logFilters: logCategories.map((cat) => ({ cat, active: state.logFilter.has(cat) })),
    logPaused: state.logPaused,
    worldDirty: state.worldDirty,
    onSave: actions.save,
    toasts: state.toasts,
    onDismissToast: actions.dismissToast,
    onToggleDebugMenu: actions.toggleDebugMenu,
    onCloseMenus: actions.closeMenus,
    onToggleGrid: actions.toggleGrid,
    onTogglePhysics: actions.togglePhysics,
    onToggleLabels: actions.toggleLabels,
    onToggleSprites: actions.toggleSprites,
    onToggleCameraLock: actions.toggleCameraLock,
    onSetToolMode: actions.setToolMode,
    onPlaybackAction: actions.playback,
    onZoomAction: actions.zoom,
    onSetZoomSensitivity: actions.setZoomSensitivity,
    onEntityQueryChange: actions.setEntityQuery,
    onInspectorQueryChange: actions.setInspectorQuery,
    onSelectEntity: actions.selectEntity,
    onToggleComponentCollapse: actions.toggleComponentCollapse,
    onInspectorEdit: actions.editInspector,
    onSaveSnapshot: actions.saveSnapshot,
    onRestoreSnapshot: actions.restoreSnapshot,
    onToggleSystem: actions.toggleSystem,
    onToggleLogFilter: actions.toggleLogFilter,
    onToggleLogPause: actions.toggleLogPause,
    onToggleGridSnap: actions.toggleGridSnap,
    onSetGridSnapSize: actions.setGridSnapSize,
    onCalcGridSnapSize: actions.calcGridSnapSize,
    onToggleRotationSnap: actions.toggleRotationSnap,
    onSetRotationSnapDeg: actions.setRotationSnapDeg,
    worlds: state.openWorlds.map((path) => ({ path, name: path.split("/").filter(Boolean).at(-1) ?? path })),
    worldName: options.activeWorld ? (options.activeWorld.split("/").filter(Boolean).at(-1) ?? options.activeWorld) : "World",
    sceneSelected: state.sceneSelected,
    availableSystems: collectGraphNames(options.contentTree ?? []).filter((name) => !(options.activeSystems ?? []).includes(name)),
    onSelectScene: actions.selectScene,
    onAddSystem: actions.addSystem,
    onRemoveSystem: actions.removeSystem,
    openDocs: state.openDocs.map((doc) => ({ ...doc, name: doc.path.split("/").filter(Boolean).at(-1) ?? doc.path })),
    activeDoc: state.activeDoc,
    onOpenDoc: actions.openDoc,
    onCloseDoc: actions.closeDoc,
    onSelectDoc: actions.selectDoc,
    onOpenWorld: actions.openWorld,
    onSelectWorld: actions.selectWorld,
    onCloseWorld: actions.closeWorld,
    onOpenLevel: actions.openLevel,
    contentDrawerOpen: state.contentDrawerOpen,
    contentTree: options.contentTree ?? [],
    engineAssets: options.engineAssets ?? [],
    activeWorld: options.activeWorld,
    activeSystems: options.activeSystems ?? [],
    onLoadWorld: actions.loadWorld,
    onToggleContentDrawer: actions.toggleContentDrawer,
    onCreateFolder: options.onCreateFolder,
    onCreateWorld: options.onCreateWorld ?? (() => {}),
    onCreateComponent: options.onCreateComponent,
    onCreatePrefab: options.onCreatePrefab,
    onCreateGraph: options.onCreateGraph,
    onImportContent: options.onImportContent,
    onDeleteContent: options.onDeleteContent,
    onRename: options.onRename,
    bookmarks: options.bookmarks ?? [],
    onBookmarksChange: options.onBookmarksChange,
    projectName: options.projectName ?? null,
    recentProjects: options.recentProjects ?? [],
    onOpenProject: actions.openProject,
    onCreateProject: actions.createProject,
    onCloseProject: actions.closeProject,
    onBrowseProject: actions.browseProject,
  }));
}

export function buildStatusCards<TWorld extends DebuggerWorld>(
  world: TWorld,
  panels: DebugStatusPanel<TWorld>[],
): DebuggerStatusCardView[] {
  return panels.flatMap((panel) => {
    const fields = panel.fields(world);
    if (fields.length === 0) return [];
    return [{
      title: panel.title,
      fields: fields.map((field) => ({
        label: field.label,
        value: field.secondary === undefined ? field.value : `${field.value}, ${field.secondary}`,
      })),
    }];
  });
}

export function buildEntityItems<TWorld extends DebuggerWorld>(
  world: TWorld,
  state: DebugState,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): DebuggerEntityItemView[] {
  const query = state.entityQuery.trim().toLowerCase();
  return Array.from(world.entities)
    .filter((entity) => {
      const title = getEntityTitle?.(world, entity) ?? entityListTitle(world, entity);
      const tags = world.tags.list(entity).join(" ");
      return `${title} ${tags} ${entity}`.toLowerCase().includes(query);
    })
    .map((entity) => ({
      entity,
      title: getEntityTitle?.(world, entity) ?? entityListTitle(world, entity),
      tag: world.tags.list(entity)[0] ?? "entity",
      selected: entity === state.selectedEntity,
    }));
}

export function buildSnapshotViews(state: DebugState): DebuggerSnapshotView[] {
  return state.snapshots.map((snapshot, index) => ({
    index,
    frame: snapshot.frame,
    entityCount: snapshot.entities.size,
  }));
}

export function buildSystemViews<TWorld extends DebuggerWorld>(
  world: TWorld,
  metrics: FrameMetric[],
  history: Map<string, number[]>,
  activeSystems: string[] = [],
): DebuggerSystemView[] {
  const entries = world.getSystemEntries();
  const metricByLabel = new Map(metrics.map((metric) => [metric.label, metric]));
  const activeSet = new Set(activeSystems);
  const visibleEntries = activeSet.size > 0 ? entries.filter((entry) => activeSet.has(entry.label)) : entries;

  return visibleEntries.map((entry) => {
    const index = entries.findIndex((candidate) => candidate.label === entry.label && candidate.enabled === entry.enabled);
    const metric = metricByLabel.get(entry.label);
    const hist = history.get(entry.label) ?? [];
    const cur = metric ? metric.durationMs : null;
    const avg = hist.length > 0 ? hist.reduce((a, b) => a + b, 0) / hist.length : null;
    const peak = hist.length > 0 ? Math.max(...hist) : null;
    return {
      index,
      label: entry.label,
      enabled: entry.enabled,
      cur,
      avg,
      peak,
      timing: !entry.enabled ? "off"
        : cur === null ? "—"
        : `${cur.toFixed(2)} / ${avg?.toFixed(2) ?? "—"} / ${peak?.toFixed(2) ?? "—"}`,
    };
  });
}

export function buildLogEntries(state: DebugState): DebuggerLogEntryView[] {
  return state.eventLog.filter((entry) => state.logFilter.has(entry.cat));
}

export function toInspectorFieldView(
  componentId: string,
  entity: Entity,
  field: { label: string; value: string; editable?: boolean; editKey?: string; selectEntity?: number; selectEntities?: number[] },
): DebuggerFieldView {
  return {
    label: field.label,
    value: field.value,
    editable: field.editable,
    componentId,
    editKey: field.editKey,
    entity,
    selectEntity: field.selectEntity,
    selectEntities: field.selectEntities,
  };
}

function collectGraphNames(nodes: import("../shared/types").ContentTreeNode[]): string[] {
  const names: string[] = [];
  const walk = (list: import("../shared/types").ContentTreeNode[]) => {
    for (const node of list) {
      if (node.kind === "graph") {
        const base = node.path.split("/").filter(Boolean).at(-1) ?? node.name;
        if (base && !names.includes(base)) names.push(base);
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return names;
}

function entityListTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `#${entity} ${firstTag}`;
}
