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
  selected: boolean;
};

export type DebuggerFieldView = {
  label: string;
  value: string;
  editable?: boolean;
  componentId?: string;
  editKey?: string;
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
