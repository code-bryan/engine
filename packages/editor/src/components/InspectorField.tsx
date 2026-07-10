// A single row in the entity Details/Inspector panel. Layout is standardized:
// a field with multiple values (a vector like Position [x, y]) renders its label
// ABOVE and the values in a row below; a single-value field renders its label to
// the LEFT with the value beside it. Editable, read-only, and entity-reference
// fields all share the same inline single-value row.

import { useEffect, useRef, useState } from "react";
import type { DebuggerFieldView } from "../shell/view-types";

const LABEL = "w-24 shrink-0 text-[#888]";
const INPUT = "engine-input flex-1 min-w-0 px-2 py-1 rounded text-right";

// An input that keeps its own text while focused so a parent re-render (the editor
// re-renders on every edit and every ticked frame) can't reset what you're typing.
function LiveInput(props: { value: string; className: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(props.value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(props.value);
  }, [props.value]);
  return (
    <input
      className={props.className}
      value={text}
      inputMode="decimal"
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(props.value); }}
      onChange={(event) => { setText(event.target.value); props.onCommit(event.target.value); }}
    />
  );
}

// Standard single-value row: label on the left, value/control on the right.
function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={LABEL}>{props.label}</span>
      {props.children}
    </div>
  );
}

export function InspectorField(
  props: {
    field: DebuggerFieldView;
    onEdit: (entity: number, componentId: string, key: string, value: string) => void;
    onSelectEntity: (entity: number) => void;
  },
) {
  const { field } = props;
  const canEdit = field.entity !== undefined && field.componentId;

  // Vector: Unity/Unreal-style — label on the left, the axis inputs inline in a row
  // on the right, each with its mini X/Y (or unit) sub-label. One row for any count.
  if (field.axes && field.axes.length > 0 && canEdit) {
    return (
      <Row label={field.label}>
        <div className="flex-1 flex gap-1 min-w-0">
          {field.axes.map((axis) => (
            <label className="flex-1 min-w-0 flex items-center gap-1" key={axis.editKey}>
              <span className="shrink-0 text-[10px] text-[#666]">{axis.label}</span>
              <LiveInput
                className={INPUT}
                value={axis.value}
                onCommit={(value) => props.onEdit(field.entity!, field.componentId!, axis.editKey, value)}
              />
            </label>
          ))}
        </div>
      </Row>
    );
  }

  // Single editable value.
  if (field.editable && canEdit && field.editKey) {
    return (
      <Row label={field.label}>
        <LiveInput
          className={INPUT}
          value={field.value}
          onCommit={(value) => props.onEdit(field.entity!, field.componentId!, field.editKey!, value)}
        />
      </Row>
    );
  }

  // Entity reference list.
  if (field.selectEntities && field.selectEntities.length > 0) {
    return (
      <Row label={field.label}>
        <div className="flex-1 flex flex-wrap gap-1 justify-end">
          {field.selectEntities.map((entity) => (
            <button className="text-[#0070e0] hover:underline" key={entity} onClick={() => props.onSelectEntity(entity)}>#{entity}</button>
          ))}
        </div>
      </Row>
    );
  }

  // Single entity reference.
  if (field.selectEntity !== undefined) {
    return (
      <Row label={field.label}>
        <button className="flex-1 text-right text-[#0070e0] hover:underline" onClick={() => props.onSelectEntity(field.selectEntity!)}>#{field.selectEntity}</button>
      </Row>
    );
  }

  // Read-only value.
  return (
    <Row label={field.label}>
      <strong className="flex-1 text-right text-[#ccc] font-mono text-[11px] truncate">{field.value}</strong>
    </Row>
  );
}
