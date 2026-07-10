import { useEffect, useState } from "react";
import {
  COMPONENT_FIELD_TYPES,
  buildComponentDefinition,
  componentFieldDotColor,
  defaultForComponentType,
  inferComponentFieldType,
  type ComponentEditKind,
  type ComponentEditState,
  type ComponentField,
  type ComponentFieldType,
} from "./component-schema";

async function fetchContentFile(path: string): Promise<unknown | null> {
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(path)}`);
  if (!response.ok) return null;
  return await response.json();
}

async function saveContentJson(path: string, value: unknown): Promise<void> {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value, null, 2),
  });
}

// `definition`, when provided, is rendered directly instead of fetching from disk
// — used for read-only engine components that have no backing file.
export type ComponentViewProps = { path: string; keyboardLocked: boolean; definition?: unknown; onSaved?: (path: string, definition: unknown) => void };

export function ComponentView(props: ComponentViewProps) {
  const [st, setSt] = useState<ComponentEditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(undefined);
    const source = props.definition !== undefined ? Promise.resolve(props.definition) : fetchContentFile(props.path);
    source
      .then((raw) => {
        if (!alive) return;
        if (!raw || typeof raw !== "object") { setError("component not found"); return; }
        const parsed = raw as { id?: string; label?: string; kind?: string; values?: unknown; defaultValue?: unknown; fields?: Record<string, { values?: unknown }>; editable?: unknown };
        const id = typeof parsed.id === "string" ? parsed.id : (props.path.split("/").filter(Boolean).at(-1) ?? "component");
        const label = typeof parsed.label === "string" ? parsed.label : id;
        const editable = parsed.editable !== false;
        const dv = parsed.defaultValue;
        let next: ComponentEditState;
        if (parsed.kind === "enum" || Array.isArray(parsed.values)) {
          const values = (Array.isArray(parsed.values) ? parsed.values : []).filter((v): v is string => typeof v === "string");
          const enumDefault = typeof dv === "string" && values.includes(dv) ? dv : values[0] ?? "";
          next = { id, label, kind: "enum", fields: [], scalarType: "String", scalarValue: enumDefault, values, enumDefault, editable };
        } else if (dv && typeof dv === "object") {
          const meta = parsed.fields;
          const fields = Object.entries(dv as Record<string, unknown>).map(([name, value]) => {
            const choices = meta?.[name]?.values;
            if (Array.isArray(choices) && choices.every((c) => typeof c === "string") && choices.length > 0) {
              return { name, type: "Enum" as const, value, values: choices as string[] };
            }
            return { name, type: inferComponentFieldType(value), value };
          });
          next = { id, label, kind: "struct", fields, scalarType: "Float", scalarValue: 0, values: [], enumDefault: "", editable };
        } else {
          const scalarType = dv === undefined ? "Float" : inferComponentFieldType(dv);
          next = { id, label, kind: "scalar", fields: [], scalarType: scalarType === "Vector2" ? "String" : scalarType, scalarValue: dv ?? 0, values: [], enumDefault: "", editable };
        }
        setSt(next);
      })
      .catch(() => { if (alive) setError("failed to load component"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [props.path, props.definition]);

  const commit = (patch: Partial<ComponentEditState>) => {
    setSt((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const definition = buildComponentDefinition(next);
      void saveContentJson(props.path, definition);
      props.onSaved?.(props.path, definition);
      return next;
    });
  };

  const changeKind = (kind: ComponentEditKind) => {
    if (!st) return;
    if (kind === "enum" && st.values.length === 0) {
      const seed = typeof st.scalarValue === "string" && st.scalarValue.trim() !== "" ? [st.scalarValue] : ["value"];
      commit({ kind, values: seed, enumDefault: seed[0] });
    } else if (kind === "scalar" && st.scalarValue === undefined) {
      commit({ kind, scalarType: "Float", scalarValue: 0 });
    } else {
      commit({ kind });
    }
  };

  const valueInput = (type: ComponentFieldType, value: unknown, onChange: (next: unknown) => void, compact = false, choices?: string[]) => {
    const cls = compact ? "engine-input px-1 py-0.5 rounded text-[10px] text-center" : "engine-input px-2 py-1.5 rounded text-white text-xs";
    if (type === "Enum") return (
      <select className={`${cls} ${compact ? "w-24" : "w-full"}`} value={String(value ?? "")} disabled={props.keyboardLocked} onChange={(e) => onChange(e.target.value)}>
        {(choices ?? []).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
    );
    if (type === "Bool") return <input type="checkbox" className="accent-[#0070e0]" checked={value === true} disabled={props.keyboardLocked} onChange={(e) => onChange(e.target.checked)} />;
    if (type === "String") return <input type="text" className={`${cls} ${compact ? "w-20" : "w-full"}`} value={String(value ?? "")} disabled={props.keyboardLocked} onChange={(e) => onChange(e.target.value)} />;
    if (type === "Vector2") {
      const v = (value && typeof value === "object" ? value : {}) as { x?: number; y?: number };
      return (
        <div className="flex gap-1">
          <input type="number" className="w-12 engine-input px-1 py-0.5 rounded text-[10px] text-center" value={Number(v.x ?? 0)} disabled={props.keyboardLocked} onChange={(e) => onChange({ x: Number(e.target.value), y: Number(v.y ?? 0) })} />
          <input type="number" className="w-12 engine-input px-1 py-0.5 rounded text-[10px] text-center" value={Number(v.y ?? 0)} disabled={props.keyboardLocked} onChange={(e) => onChange({ x: Number(v.x ?? 0), y: Number(e.target.value) })} />
        </div>
      );
    }
    return <input type="number" className={`${cls} ${compact ? "w-20" : "w-full"}`} value={Number(value ?? 0)} disabled={props.keyboardLocked} onChange={(e) => onChange(type === "Int" ? Math.round(Number(e.target.value)) : Number(e.target.value))} />;
  };

  const definition = st ? buildComponentDefinition(st) : {};
  const json = JSON.stringify(definition, null, 2);
  const copyJson = () => { void navigator.clipboard?.writeText(json); setCopied(true); window.setTimeout(() => setCopied(false), 1200); };

  const previewValue = (field: ComponentField) => {
    if (field.type === "Vector2") {
      const v = (field.value && typeof field.value === "object" ? field.value : {}) as { x?: number; y?: number };
      return `(${v.x ?? 0}, ${v.y ?? 0})`;
    }
    return String(field.value);
  };

  return (
    <div className="absolute inset-0 z-40 flex pointer-events-auto text-xs">
      {/* Center: preview card + live JSON */}
      <div className="flex-1 flex bg-[#141414] p-6 gap-6 overflow-auto min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          {loading ? <div className="text-[#666]">loading component…</div> : error ? <div className="text-[#666]">{error}</div> : st && (
            <div className="w-72 bg-[#1e1e1e] border border-black rounded-md shadow-2xl flex flex-col font-sans text-[11px]">
              <div className="h-8 bg-gradient-to-r from-purple-800 to-purple-700 rounded-t-md flex items-center justify-between px-3 text-white font-bold tracking-wide border-b border-black">
                <div className="flex items-center gap-1.5 min-w-0"><i className="ph-fill ph-puzzle-piece text-lg opacity-80" /><span className="truncate">{st.label || st.id}</span></div>
                <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded shrink-0">v1</span>
              </div>
              <div className="p-3 py-4 space-y-2">
                {st.kind === "enum" ? (
                  <>
                    <div className="text-[#888] font-bold uppercase text-[9px] tracking-wider mb-1">Enum Values</div>
                    {st.values.length === 0 ? <div className="text-[#666]">no values</div> : st.values.map((v, i) => (
                      <div key={i} className="flex justify-between items-center bg-[#111] p-1.5 rounded border border-[#303030]">
                        <div className="flex items-center gap-2 min-w-0"><div className="w-3 h-3 rounded-full shrink-0 bg-purple-400 shadow-[0_0_5px_#a78bfa]" /><span className="text-white truncate">{v}</span></div>
                        {v === st.enumDefault && <span className="text-[#888] text-[10px] bg-[#222] px-1.5 rounded shrink-0">default</span>}
                      </div>
                    ))}
                  </>
                ) : st.kind === "scalar" ? (
                  <>
                    <div className="text-[#888] font-bold uppercase text-[9px] tracking-wider mb-1">Value</div>
                    <div className="flex justify-between items-center bg-[#111] p-1.5 rounded border border-[#303030]">
                      <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full shrink-0 ${componentFieldDotColor(st.scalarType)}`} /><span className="text-white">value</span></div>
                      <span className="text-[#888] text-[10px] bg-[#222] px-1.5 rounded shrink-0">{String(st.scalarValue)} ({st.scalarType})</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[#888] font-bold uppercase text-[9px] tracking-wider mb-1">Default Values Struct</div>
                    {st.fields.length === 0 ? <div className="text-[#666]">no fields</div> : st.fields.map((field, i) => (
                      <div key={i} className="flex justify-between items-center bg-[#111] p-1.5 rounded border border-[#303030]">
                        <div className="flex items-center gap-2 min-w-0"><div className={`w-3 h-3 rounded-full shrink-0 ${componentFieldDotColor(field.type)}`} /><span className="text-white truncate">{field.name}</span></div>
                        <span className="text-[#888] text-[10px] bg-[#222] px-1.5 rounded shrink-0">{previewValue(field)} ({field.type})</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="w-80 bg-[#1a1a1a] border border-[#303030] rounded flex flex-col shadow-xl flex-shrink-0">
          <div className="h-8 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030] text-white font-medium">
            Live JSON Output
            <i className={`ph ${copied ? "ph-check text-[#4ade80]" : "ph-copy text-[#888] hover:text-white"} cursor-pointer`} title="Copy JSON" onClick={copyJson} />
          </div>
          <pre className="flex-1 p-4 text-[#a3e635] text-[11px] overflow-auto font-mono bg-[#0f0f0f] leading-relaxed whitespace-pre">{json}</pre>
        </div>
      </div>

      {/* Right: metadata + shape editor */}
      <aside className="w-72 bg-[#1e1e1e] border-l border-[#303030] flex flex-col flex-shrink-0 shadow-xl">
        <div className="flex-1 flex flex-col border-b border-[#303030] min-h-[35%]">
          <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none">Component Metadata</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="space-y-1">
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Label</span>
              <input type="text" className="w-full engine-input px-2 py-1.5 rounded text-white text-xs" value={st?.label ?? ""} disabled={props.keyboardLocked || !st} onChange={(e) => commit({ label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">ID (Internal)</span>
              <input type="text" className="w-full engine-input px-2 py-1.5 rounded text-[#aaa] text-xs font-mono opacity-70 cursor-not-allowed" value={st?.id ?? ""} readOnly title="Auto-generated on creation" />
            </div>
            <div className="space-y-1">
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Kind</span>
              <select className="w-full engine-input px-2 py-1.5 rounded text-white text-xs" value={st?.kind ?? "struct"} disabled={props.keyboardLocked || !st} onChange={(e) => changeKind(e.target.value as ComponentEditKind)}>
                <option value="struct">Struct</option>
                <option value="scalar">Scalar</option>
                <option value="enum">Enum</option>
              </select>
            </div>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input type="checkbox" className="accent-[#0070e0]" checked={st?.editable !== false} disabled={props.keyboardLocked || !st} onChange={(e) => commit({ editable: e.target.checked })} />
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Editable in Details</span>
            </label>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[45%]">
          {st?.kind === "enum" ? (
            <>
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none justify-between">
                Enum Values
                <i className="ph ph-plus text-[#888] hover:text-white cursor-pointer" title="Add value" onClick={() => commit({ values: [...st.values, `value${st.values.length + 1}`] })} />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {st.values.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#252526] rounded border border-[#303030] p-2">
                    <input type="radio" className="accent-[#0070e0]" title="Default" checked={st.enumDefault === v} disabled={props.keyboardLocked} onChange={() => commit({ enumDefault: v })} />
                    <input type="text" className="flex-1 min-w-0 bg-black border border-[#444] text-white px-1 py-0.5 text-xs rounded focus:border-[#0070e0] outline-none" value={v} disabled={props.keyboardLocked}
                      onChange={(e) => { const values = st.values.map((x, xi) => xi === i ? e.target.value : x); commit({ values, enumDefault: st.enumDefault === v ? e.target.value : st.enumDefault }); }} />
                    <i className="ph ph-trash text-[#f87171] hover:text-red-400 cursor-pointer" title="Remove" onClick={() => { if (!props.keyboardLocked) commit({ values: st.values.filter((_, xi) => xi !== i) }); }} />
                  </div>
                ))}
                {st.values.length === 0 && <div className="text-[#666] p-2">no values</div>}
              </div>
            </>
          ) : st?.kind === "scalar" ? (
            <>
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none">Value</div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="space-y-1">
                  <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Type</span>
                  <select className="w-full engine-input px-2 py-1.5 rounded text-white text-xs" value={st.scalarType} disabled={props.keyboardLocked}
                    onChange={(e) => { const type = e.target.value as ComponentFieldType; commit({ scalarType: type, scalarValue: defaultForComponentType(type) }); }}>
                    {COMPONENT_FIELD_TYPES.filter((t) => t !== "Vector2" && t !== "Enum").map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Default</span>
                  {valueInput(st.scalarType, st.scalarValue, (next) => commit({ scalarValue: next }))}
                </div>
              </div>
            </>
          ) : st ? (
            <>
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none justify-between">
                Schema / Fields
                <i className="ph ph-plus text-[#888] hover:text-white cursor-pointer" title="Add Field" onClick={() => commit({ fields: [...st.fields, { name: `field${st.fields.length + 1}`, type: "Float", value: 0 }] })} />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {st.fields.map((field, index) => (
                  <div key={index} className="bg-[#252526] rounded border border-[#303030] p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <i className="ph ph-dots-six-vertical text-[#888]" />
                        <input type="text" className="w-20 bg-black border border-[#444] text-white px-1 text-xs rounded focus:border-[#0070e0] outline-none" value={field.name} disabled={props.keyboardLocked}
                          onChange={(e) => commit({ fields: st.fields.map((f, i) => i === index ? { ...f, name: e.target.value } : f) })} />
                      </div>
                      <i className="ph ph-trash text-[#f87171] hover:text-red-400 cursor-pointer" title="Remove field" onClick={() => { if (!props.keyboardLocked) commit({ fields: st.fields.filter((_, i) => i !== index) }); }} />
                    </div>
                    <div className="flex gap-2 items-center">
                      <select className="flex-1 engine-input px-1 py-1 rounded text-white text-xs" value={field.type} disabled={props.keyboardLocked}
                        onChange={(e) => {
                          const type = e.target.value as ComponentFieldType;
                          const values = type === "Enum" ? (field.values?.length ? field.values : ["value1"]) : undefined;
                          const value = type === "Enum" ? (values?.[0] ?? "") : defaultForComponentType(type);
                          commit({ fields: st.fields.map((f, i) => i === index ? { ...f, type, value, values } : f) });
                        }}>
                        {COMPONENT_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {valueInput(field.type, field.value, (next) => commit({ fields: st.fields.map((f, i) => i === index ? { ...f, value: next } : f) }), true, field.values)}
                    </div>
                    {field.type === "Enum" && (
                      <input
                        type="text"
                        className="w-full bg-black border border-[#444] text-white px-1 py-0.5 text-[10px] rounded focus:border-[#0070e0] outline-none"
                        placeholder="comma,separated,choices"
                        value={(field.values ?? []).join(", ")}
                        disabled={props.keyboardLocked}
                        onChange={(e) => {
                          const values = e.target.value.split(",").map((v) => v.trim()).filter((v) => v !== "");
                          const value = values.includes(String(field.value)) ? field.value : values[0] ?? "";
                          commit({ fields: st.fields.map((f, i) => i === index ? { ...f, values, value } : f) });
                        }}
                      />
                    )}
                  </div>
                ))}
                <button className="w-full py-1.5 mt-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white transition-colors flex justify-center items-center gap-2 disabled:opacity-40" disabled={props.keyboardLocked} onClick={() => commit({ fields: [...st.fields, { name: `field${st.fields.length + 1}`, type: "Float", value: 0 }] })}>
                  <i className="ph ph-plus" /> Add Property
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
