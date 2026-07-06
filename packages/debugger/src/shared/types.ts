import type { Entity, World } from "@engine/ecs-core";
import type { Physics } from "@engine/physics";

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

export type EditorToolMode = "select" | "move" | "scale" | "rotate";

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

export type ContentTreeNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "prefab" | "component" | "graph";
  children?: ContentTreeNode[];
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
  onWorldEdited?: (world: TWorld) => void;
  onOpenLevel?: () => void;
  contentTree?: ContentTreeNode[];
  activeWorld?: string;
  activeSystems?: string[];
  onLoadWorld?: (name: string) => void;
  onCreateWorld?: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateComponent?: (path: string) => void;
  initialContentDrawerOpen?: boolean;
  onContentDrawerToggled?: (open: boolean) => void;
};

export type DebugEditor<TWorld extends DebuggerWorld = DebuggerWorld> = {
  world: TWorld;
  destroy: () => void;
};

export type FrameMetric = {
  label: string;
  durationMs: number;
};

export type EntitySnapshot = {
  components: Map<string, unknown>;
  physics?: { x: number; y: number; vx: number; vy: number };
};

export type WorldSnapshot = {
  frame: number;
  entities: Map<Entity, EntitySnapshot>;
};

export type DebugWorldSnapshot = WorldSnapshot;

export type LogCategory = "entity" | "tag" | "system" | "physics" | "collision" | "store";
export type LogEntry = { cat: LogCategory; text: string; count: number };

export const ALL_LOG_CATEGORIES: LogCategory[] = ["entity", "tag", "collision", "physics", "store", "system"];

export const DEFAULT_GRID_OPTIONS: Required<DebugGridOptions> = {
  snapSize: 16,
  majorEvery: 4,
  minMinorScreenPx: 10,
  maxMinorScreenPx: 28,
};

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
  lockTarget: Entity | undefined;
  toolMode: EditorToolMode;
  entityQuery: string;
  inspectorQuery: string;
  openDropdown: string | undefined;
  contentDrawerOpen: boolean;
};
