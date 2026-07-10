import { attachEditor, createStoreInspector, type ContentBookmark, type ContentTreeNode, type DebugEditorField, type DebuggerWorld } from "@engine/editor";
import { getComponentDefinitions, getComponentStore, getPremadeAssets, getPremadeComponentIds, upsertComponentDefinition, entityFolders, entityExtends, entityNames, worldOrder, type ComponentDefinition } from "@engine/runtime";
import type { ComponentStore, Entity } from "@engine/ecs-core";
import { keyboard, pointer } from "@engine/input";
import type { EngineApplication } from "@engine/renderer";
import type { GameWorld } from "../app";

export type DebugEditorPlayback = {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: () => void;
  getState: () => "playing" | "paused" | "stopped";
  onSaveWorld?: (world: GameWorld) => void;
  onOpenLevel?: (data: unknown) => void;
  onLoadWorld?: (name: string) => void;
  onCreateWorld?: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateComponent?: (path: string) => void;
  onCreatePrefab?: (path: string) => void;
  onCreateGraph?: (path: string) => void;
  onImportContent?: (path: string, value: unknown) => void;
  onDeleteContent?: (path: string, kind: "folder" | "world" | "prefab" | "component" | "graph" | "file") => void;
  onRename?: (from: string, to: string, kind: "folder" | "world" | "prefab" | "component" | "graph" | "file") => void;
  onAddSystem?: (name: string) => void;
  onRemoveSystem?: (name: string) => void;
  onOpenProject?: (path: string) => void;
  onCreateProject?: (path: string) => void;
  onCloseProject?: () => void;
  onBrowseProject?: (mode: "open" | "create") => Promise<string | null>;
};

export type DebugEditorOptions = DebugEditorPlayback & {
  bookmarks?: ContentBookmark[];
  onBookmarksChange?: (bookmarks: ContentBookmark[]) => void;
  projectTags?: string[];
  onProjectTagsChange?: (tags: string[]) => void;
  contentTree?: ContentTreeNode[];
  activeWorld?: string;
  activeSystems?: string[];
  initialContentDrawerOpen?: boolean;
  onContentDrawerToggled?: (open: boolean) => void;
  initialOpenWorlds?: string[];
  onOpenWorldsChanged?: (paths: string[]) => void;
  projectName?: string | null;
  recentProjects?: string[];
};

export function attachDebugEditor(world: GameWorld, engine: EngineApplication, options: DebugEditorOptions) {
  const playback = options;
  // Built from the live component registry; rebuilt after a hot-reloaded edit.
  const premadeIds = new Set(getPremadeComponentIds());
  const buildComponents = () => getComponentDefinitions().map((def) => {
    const store = getComponentStore<unknown>(def.id);
    const inspector = createStoreInspector<unknown>({
      id: def.id,
      title: def.label,
      store,
      fields: (value) => componentFields(def, value),
      set: def.editable === false
        ? undefined
        : (value, key, next, _world, entity) => setComponentField(store, value, key, next, entity, def),
    });
    return {
      ...inspector,
      premade: premadeIds.has(def.id),
      // Attach with the definition's default value (kind-appropriate fallback).
      add: (_world: DebuggerWorld, entity: number) => store.set(entity, defaultComponentValue(def)),
    };
  });

  let editor: ReturnType<typeof attachEditor>;
  editor = attachEditor(world, engine, {
    playback,
    onComponentSaved(_path, definition) {
      // Re-register the edited definition, then refresh the Details inspectors.
      try { upsertComponentDefinition(definition); } catch { return; }
      editor.setComponents(buildComponents());
    },
    onSaveWorld: playback.onSaveWorld,
    onLoadWorld: playback.onLoadWorld,
    onCreateWorld: playback.onCreateWorld,
    onCreateFolder: playback.onCreateFolder,
    onCreateComponent: playback.onCreateComponent,
    onCreatePrefab: playback.onCreatePrefab,
    onCreateGraph: playback.onCreateGraph,
    onImportContent: playback.onImportContent,
    onDeleteContent: playback.onDeleteContent,
    onRename: playback.onRename,
    bookmarks: options.bookmarks,
    onBookmarksChange: options.onBookmarksChange,
    projectTags: options.projectTags,
    onProjectTagsChange: options.onProjectTagsChange,
    onAddSystem: playback.onAddSystem,
    onRemoveSystem: playback.onRemoveSystem,
    onOpenProject: playback.onOpenProject,
    onCreateProject: playback.onCreateProject,
    onCloseProject: playback.onCloseProject,
    onBrowseProject: playback.onBrowseProject,
    projectName: options.projectName,
    recentProjects: options.recentProjects,
    contentTree: options.contentTree,
    engineAssets: getPremadeAssets(),
    activeWorld: options.activeWorld,
    activeSystems: options.activeSystems,
    initialContentDrawerOpen: options.initialContentDrawerOpen,
    onContentDrawerToggled: options.onContentDrawerToggled,
    initialOpenWorlds: options.initialOpenWorlds,
    onOpenWorldsChanged: options.onOpenWorldsChanged,
    onOpenLevel: playback.onOpenLevel ? () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        file.text().then((text) => {
          try {
            playback.onOpenLevel!(JSON.parse(text));
          } catch {}
        });
      };
      input.click();
    } : undefined,
    grid: {
      snapSize: 16,
      majorEvery: 4,
      minMinorScreenPx: 10,
      maxMinorScreenPx: 24,
    },
    statusPanels: [
      {
        id: "input",
        title: "Input",
        fields() {
          const kb = keyboard.get(0);
          const ptr = pointer.get(0);
          const held = Array.from(kb?.keys ?? []);
          const pressed = Array.from(kb?.pressed ?? []);
          const released = Array.from(kb?.released ?? []);
          return [
            { label: "Held", value: held.length === 0 ? "-" : held.join(", ") },
            { label: "Pressed", value: pressed.length === 0 ? "-" : pressed.join(", ") },
            { label: "Released", value: released.length === 0 ? "-" : released.join(", ") },
            { label: "Pointer", value: ptr ? `${ptr.x.toFixed(0)}, ${ptr.y.toFixed(0)}` : "-" },
            { label: "Pointer btn", value: ptr ? (ptr.down ? "down" : "up") : "-" },
          ];
        },
      },
    ],
    getEntityTitle(debugWorld: DebuggerWorld, entity: number) {
      const custom = entityNames.get(entity);
      if (custom) return custom;
      const tag = debugWorld.tags.list(entity)[0] ?? "entity";
      return `${tag.slice(0, 1).toUpperCase()}${tag.slice(1)}_${entity}`;
    },
    getEntityFolder(_debugWorld: DebuggerWorld, entity: number) {
      return entityFolders.get(entity);
    },
    getEntityName(_debugWorld: DebuggerWorld, entity: number) {
      return entityNames.get(entity);
    },
    getEntityPrefab(_debugWorld: DebuggerWorld, entity: number) {
      return entityExtends.get(entity);
    },
    getWorldOrder() {
      // worldOrder is the runtime's live ordered element list; hand back a shallow
      // copy so the editor never mutates it directly.
      return worldOrder.map((item) => ({ ...item }));
    },
    // One inspector per project component definition, derived from its kind/shape.
    // Struct (object) → editable numeric fields per key; enum → dropdown of its
    // values; scalar → editable value.
    components: buildComponents(),
    getRuntimeDetails(debugWorld: DebuggerWorld, entity?: number) {
      if (entity === undefined) return "selection: none";
      const lines = [
        `entity: ${entity}`,
        `tags: ${debugWorld.tags.list(entity).join(", ") || "-"}`,
      ];
      for (const def of getComponentDefinitions()) {
        const value = getComponentStore<unknown>(def.id).get(entity);
        if (value === undefined) continue;
        lines.push(`${def.id}: ${value !== null && typeof value === "object" ? JSON.stringify(value) : String(value)}`);
      }
      return lines.join("\n");
    },
  });
  return editor;
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

// Rows for one component value. Object → a row per key (numbers editable); primitive → a single value row.
// Unity-style: a component flagged `editable:false` is hidden entirely (empty →
// buildInspectorCards drops the card), as is any struct field flagged `editable:false`.
function componentFields(def: ComponentDefinition, value: unknown): DebugEditorField[] {
  if (def.editable === false) return [];

  // Enum → a dropdown of its values (read-only text if it declares none).
  if (def.kind === "enum") {
    const display = typeof value === "string" ? value : String(def.defaultValue ?? "-");
    const editable = (def.values?.length ?? 0) > 0;
    return [{ label: "Value", value: display, ...(editable ? { editable: true, editKey: "value", options: def.values } : {}) }];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => def.fields?.[key]?.editable !== false) // hide fields explicitly marked non-editable
      .map(([key, val]) => {
        const numeric = typeof val === "number";
        const fc = def.fields?.[key];
        return {
          label: fc?.label ?? titleize(key),
          value: numeric ? formatNumber(val as number) : String(val),
          ...(numeric ? { editable: true, editKey: key } : {}),
        };
      });
  }
  // Scalar (enum already returned above).
  return [{ label: "Value", value: String(value), editable: true, editKey: "value" }];
}

// Clamp/round a numeric edit to the effective constraints (per-field override,
// falling back to component-level).
function constrainNumber(value: number, def: ComponentDefinition, key?: string) {
  const fc = key ? def.fields?.[key] : undefined;
  const integer = fc?.integer ?? def.integer;
  const min = fc?.min ?? def.min;
  const max = fc?.max ?? def.max;
  let v = value;
  if (integer) v = Math.round(v);
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

// Write an edited field back. Object → mutate the numeric key in place; primitive → replace the store entry.
function setComponentField(store: ComponentStore<unknown>, value: unknown, key: string, next: string, entity: Entity, def: ComponentDefinition) {
  // Enum: the whole component value is the selected string; only accept declared values.
  if (def.kind === "enum") {
    if (def.values?.includes(next)) store.set(entity, next);
    return;
  }
  if (value !== null && typeof value === "object") {
    // Guard: a per-field editable:false is never written even if a stale edit arrives.
    if (def.fields?.[key]?.editable === false) return;
    const record = value as Record<string, unknown>;
    if (typeof record[key] === "number") {
      const numeric = Number(next);
      if (!Number.isNaN(numeric)) record[key] = constrainNumber(numeric, def, key);
    }
    return;
  }
  const numeric = Number(next);
  store.set(entity, next.trim() !== "" && !Number.isNaN(numeric) ? constrainNumber(numeric, def) : next);
}

// Default value used when attaching a component: the declared default, else a
// kind-appropriate fallback (first enum value / 0 / empty struct).
function defaultComponentValue(def: ComponentDefinition): unknown {
  if (def.defaultValue !== undefined) return cloneValue(def.defaultValue);
  if (def.kind === "enum") return def.values?.[0] ?? "";
  if (def.kind === "scalar") return 0;
  return {};
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

// "spawnX" → "Spawn X", "speed" → "Speed".
function titleize(key: string) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
