// Public API of @engine/editor. The editor attaches to a live World + engine and
// renders a full editing UI over the game viewport. Internals are organized by
// feature under ./features, with the imperative host in ./platform, the UI shell
// in ./shell, and UI state in ./state.

export { attachEditor } from "./platform/attach";
export { createStoreInspector } from "./features/inspector/cards";
export { captureWorldSnapshot, restoreWorldSnapshot } from "./features/snapshots/snapshots";

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
