import type { Entity, World } from "@engine/ecs-core";
import type { Physics } from "@engine/physics";
import type { Transform } from "@engine/components";

export type DebuggerWorld = World & { physics: Physics };

// One editable axis inside a grouped vector field (e.g. x / y of a position).
export type DebugFieldAxis = { label: string; value: string; editKey: string };

export type DebugEditorField = {
  label: string;
  value: string;
  secondary?: string;
  editable?: boolean;
  editKey?: string;
  selectEntity?: Entity;
  selectEntities?: Entity[];
  // When set, the field renders as a group: `label` above, one input per axis
  // below (position/scale → [x, y]; rotation → [angle]). Each axis edits via its
  // own editKey through the normal edit path.
  axes?: DebugFieldAxis[];
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
  kind: "folder" | "world" | "prefab" | "component" | "graph" | "file";
  children?: ContentTreeNode[];
};

// A premade, engine-provided asset shown read-only under the content browser's
// Engine tab. Usable in worlds by id without importing into the project; `body`
// is the definition surfaced in preview.
export type EngineAsset = {
  kind: "component" | "system" | "prefab";
  id: string;
  label: string;
  body?: unknown;
};

// A user-defined quick-access collection of content items, persisted in the
// project manifest. Tapping a bookmark filters the browser to its members.
export type ContentBookmark = {
  id: string;
  name: string;
  items: string[];
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
  // Persist the world to disk. Called on an explicit save (⌘/Ctrl+S / File ▸ Save),
  // NOT on every edit — in-editor changes only mark the world dirty in memory.
  onSaveWorld?: (world: TWorld) => void;
  onOpenLevel?: () => void;
  contentTree?: ContentTreeNode[];
  engineAssets?: EngineAsset[];
  activeWorld?: string;
  activeSystems?: string[];
  onLoadWorld?: (name: string) => void;
  onCreateWorld?: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateComponent?: (path: string) => void;
  onCreatePrefab?: (path: string) => void;
  onCreateGraph?: (path: string) => void;
  onImportContent?: (path: string, value: unknown) => void;
  onDeleteContent?: (path: string, kind: ContentTreeNode["kind"]) => void;
  onRename?: (from: string, to: string, kind: ContentTreeNode["kind"]) => void;
  bookmarks?: ContentBookmark[];
  onBookmarksChange?: (bookmarks: ContentBookmark[]) => void;
  initialContentDrawerOpen?: boolean;
  onContentDrawerToggled?: (open: boolean) => void;
  initialOpenWorlds?: string[];
  onOpenWorldsChanged?: (paths: string[]) => void;
  onAddSystem?: (name: string) => void;
  onRemoveSystem?: (name: string) => void;
  projectName?: string | null;
  recentProjects?: string[];
  onOpenProject?: (path: string) => void;
  onCreateProject?: (path: string) => void;
  onCloseProject?: () => void;
  onBrowseProject?: (mode: "open" | "create") => Promise<string | null>;
};

export type DebugEditor<TWorld extends DebuggerWorld = DebuggerWorld> = {
  world: TWorld;
  setActiveSystems: (names: string[]) => void;
  setContentTree: (tree: ContentTreeNode[]) => void;
  setBookmarks: (bookmarks: ContentBookmark[]) => void;
  setActiveWorld: (name: string, opts?: { activeSystems?: string[]; contentTree?: ContentTreeNode[] }) => void;
  renameContent: (from: string, to: string) => void;
  destroy: () => void;
};

export type FrameMetric = {
  label: string;
  durationMs: number;
};

export type EntitySnapshot = {
  components: Map<string, unknown>;
  physics?: { x: number; y: number; vx: number; vy: number };
  transform?: Transform;
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

// DebugState now lives in ../state/types alongside its reducer. Re-exported here
// so existing importers keep resolving it from the shared types barrel.
export type { DebugState } from "../state/types";
export type { EditorAction } from "../state/types";
