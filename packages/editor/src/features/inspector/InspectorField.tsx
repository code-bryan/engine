// A single row in the entity Details/Inspector panel: an editable input, an
// entity-reference link (single or list), or a read-only label/value. Verbatim
// from the original debugger-ui.

import type { DebuggerFieldView } from "../../shell/view-types";

export function InspectorField(
  props: {
    field: DebuggerFieldView;
    onEdit: (entity: number, componentId: string, key: string, value: string) => void;
    onSelectEntity: (entity: number) => void;
  },
) {
  const { field } = props;

  if (field.editable && field.entity !== undefined && field.componentId && field.editKey) {
    return (
      <label className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[#888]">{field.label}</span>
        <input
          className="engine-input flex-1 px-2 py-1 rounded text-right"
          value={field.value}
          onChange={(event) => props.onEdit(field.entity!, field.componentId!, field.editKey!, event.target.value)}
        />
      </label>
    );
  }

  if (field.selectEntities && field.selectEntities.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[#888]">{field.label}</span>
        <div className="flex flex-wrap gap-1">
          {field.selectEntities.map((entity) => (
            <button className="text-[#0070e0] hover:underline" key={entity} onClick={() => props.onSelectEntity(entity)}>#{entity}</button>
          ))}
        </div>
      </div>
    );
  }

  if (field.selectEntity !== undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[#888]">{field.label}</span>
        <button className="text-[#0070e0] hover:underline" onClick={() => props.onSelectEntity(field.selectEntity!)}>#{field.selectEntity}</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#888]">{field.label}</span>
      <strong className="text-[#ccc] font-mono text-[11px] truncate">{field.value}</strong>
    </div>
  );
}
