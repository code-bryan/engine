// Plain view-model value types the React tree renders. Built by the per-feature
// view-model builders (see ./view-model + features/*/view-model) and consumed by
// the shell + feature components. Moved verbatim from the original debugger-ui.

export type DebuggerStatusCardView = {
  title: string;
  fields: Array<{ label: string; value: string }>;
};

export type DebuggerEntityItemView = {
  entity: number;
  title: string;
  tag: string;
  tags: string[];
  selected: boolean;
  folder?: string;
  // Custom name if set; undefined means the title is the tag-derived default.
  customName?: string;
};

// A component the selected entity can have attached (Add Component menu).
export type DebuggerAddableComponentView = { id: string; label: string; premade: boolean };

// One node in the ordered outliner tree: a folder (with its ordered entity
// children) or a top-level (loose) entity. Built by buildOutline from the world's
// element order.
export type DebuggerOutlineNodeView =
  | { kind: "folder"; name: string; children: DebuggerEntityItemView[] }
  | { kind: "entity"; entity: DebuggerEntityItemView };

export type DebuggerFieldView = {
  label: string;
  value: string;
  editable?: boolean;
  componentId?: string;
  editKey?: string;
  options?: string[];
  entity?: number;
  selectEntity?: number;
  selectEntities?: number[];
  // Grouped vector layout: label above, one input per axis below.
  axes?: { label: string; value: string; editKey: string }[];
};

export type DebuggerInspectorCardView = {
  id: string;
  title: string;
  collapsed: boolean;
  fields: DebuggerFieldView[];
  // Whether the component has any fields (drives the collapse chevron — an empty
  // header isn't collapsible) and whether it can be detached (shows a remove icon).
  hasFields: boolean;
  removable: boolean;
};

export type DebuggerSnapshotView = {
  index: number;
  frame: number;
  entityCount: number;
};

export type DebuggerSystemView = {
  index: number;
  label: string;
  enabled: boolean;
  timing: string;
  cur: number | null;
  avg: number | null;
  peak: number | null;
};

export type DebuggerLogEntryView = {
  cat: string;
  text: string;
  count: number;
};
