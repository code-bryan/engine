export type ComponentFieldType = "Float" | "Int" | "Bool" | "String" | "Vector2";
export const COMPONENT_FIELD_TYPES: ComponentFieldType[] = ["Float", "Int", "Bool", "String", "Vector2"];
export type ComponentField = { name: string; type: ComponentFieldType; value: unknown };

export function inferComponentFieldType(value: unknown): ComponentFieldType {
  if (typeof value === "boolean") return "Bool";
  if (typeof value === "number") return Number.isInteger(value) ? "Int" : "Float";
  if (typeof value === "string") return "String";
  if (value && typeof value === "object" && "x" in value && "y" in value) return "Vector2";
  return "String";
}

export function defaultForComponentType(type: ComponentFieldType): unknown {
  if (type === "Bool") return false;
  if (type === "String") return "";
  if (type === "Vector2") return { x: 0, y: 0 };
  return 0;
}

export function componentFieldDotColor(type: ComponentFieldType): string {
  if (type === "Bool") return "bg-[#f87171] shadow-[0_0_5px_#f87171]";
  if (type === "String") return "bg-[#60a5fa] shadow-[0_0_5px_#60a5fa]";
  if (type === "Vector2") return "bg-[#eab308] shadow-[0_0_5px_#eab308]";
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
};

export function buildComponentDefinition(st: ComponentEditState): Record<string, unknown> {
  const base = { version: 1, id: st.id, label: st.label };
  if (st.kind === "enum") {
    const values = st.values.map((v) => v.trim()).filter((v) => v !== "");
    const defaultValue = values.includes(st.enumDefault) ? st.enumDefault : values[0] ?? "";
    return { ...base, kind: "enum", values, defaultValue };
  }
  if (st.kind === "scalar") {
    return { ...base, defaultValue: st.scalarValue };
  }
  return {
    ...base,
    defaultValue: Object.fromEntries(st.fields.filter((f) => f.name.trim() !== "").map((f) => [f.name, f.value])),
  };
}
