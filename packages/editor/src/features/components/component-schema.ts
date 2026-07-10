export type ComponentFieldType = "Float" | "Int" | "Bool" | "String" | "Vector2" | "Enum";
export const COMPONENT_FIELD_TYPES: ComponentFieldType[] = ["Float", "Int", "Bool", "String", "Vector2", "Enum"];
// An Enum field's `value` is still a plain string (one of `values`); the allowed
// choices live in `values`, persisted via the definition's `fields` metadata.
export type ComponentField = { name: string; type: ComponentFieldType; value: unknown; values?: string[] };

export function inferComponentFieldType(value: unknown): ComponentFieldType {
  if (typeof value === "boolean") return "Bool";
  if (typeof value === "number") return Number.isInteger(value) ? "Int" : "Float";
  if (typeof value === "string") return "String";
  if (value && typeof value === "object" && "x" in value && "y" in value) return "Vector2";
  return "String";
}

export function defaultForComponentType(type: ComponentFieldType): unknown {
  if (type === "Bool") return false;
  if (type === "String" || type === "Enum") return "";
  if (type === "Vector2") return { x: 0, y: 0 };
  return 0;
}

export function componentFieldDotColor(type: ComponentFieldType): string {
  if (type === "Bool") return "bg-[#f87171] shadow-[0_0_5px_#f87171]";
  if (type === "String") return "bg-[#60a5fa] shadow-[0_0_5px_#60a5fa]";
  if (type === "Vector2") return "bg-[#eab308] shadow-[0_0_5px_#eab308]";
  if (type === "Enum") return "bg-[#a78bfa] shadow-[0_0_5px_#a78bfa]";
  return "bg-[#4ade80] shadow-[0_0_5px_#4ade80]";
}


export type ComponentEditKind = "struct" | "scalar" | "enum";
export type ComponentEditState = {
  id: string;
  label: string;
  kind: ComponentEditKind;
  fields: ComponentField[];
  scalarType: ComponentFieldType;
  scalarValue: unknown;
  values: string[];
  enumDefault: string;
  // Whether the component is editable in the Details panel (default true).
  editable: boolean;
};

export function buildComponentDefinition(st: ComponentEditState): Record<string, unknown> {
  const base = { version: 1, id: st.id, label: st.label, ...(st.editable === false ? { editable: false } : {}) };
  if (st.kind === "enum") {
    const values = st.values.map((v) => v.trim()).filter((v) => v !== "");
    const defaultValue = values.includes(st.enumDefault) ? st.enumDefault : values[0] ?? "";
    return { ...base, kind: "enum", values, defaultValue };
  }
  if (st.kind === "scalar") {
    return { ...base, defaultValue: st.scalarValue };
  }
  const named = st.fields.filter((f) => f.name.trim() !== "");
  // Enum fields keep their value in defaultValue and their choices in `fields`.
  const enumMeta = named.filter((f) => f.type === "Enum" && (f.values?.length ?? 0) > 0);
  return {
    ...base,
    defaultValue: Object.fromEntries(named.map((f) => [f.name, f.value])),
    ...(enumMeta.length > 0
      ? { fields: Object.fromEntries(enumMeta.map((f) => [f.name, { values: f.values }])) }
      : {}),
  };
}
