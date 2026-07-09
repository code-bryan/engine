export function blueprintNodeAccent(type: string): { grad: string; icon: string; text: string } {
  if (/^On[A-Z]/.test(type) || /Event|Update|Start|Tick/i.test(type)) {
    return { grad: "from-red-800 to-red-700", icon: "ph-fill ph-lightning", text: "text-red-500" };
  }
  if (/Filter|Has|Check|Query|If|Branch|Compare|Is[A-Z]/i.test(type)) {
    return { grad: "from-blue-800 to-blue-700", icon: "ph-fill ph-funnel", text: "text-blue-400" };
  }
  if (/Set|Add|Apply|Move|Spawn|Destroy|Write|Emit|Play|Change|Update/i.test(type)) {
    return { grad: "from-emerald-700 to-emerald-600", icon: "ph-fill ph-arrow-circle-right", text: "text-emerald-500" };
  }
  return { grad: "from-slate-700 to-slate-600", icon: "ph-fill ph-circle", text: "text-slate-400" };
}

export function portDotClass(kind: string): string {
  if (kind === "flow") return "w-3 h-3 bg-white border border-black rotate-45 rounded-[2px]";
  if (kind === "signal") return "w-3 h-3 rounded-full bg-amber-500 border border-black";
  return "w-3 h-3 rounded-full bg-cyan-500 border border-black";
}

export function wireColor(kind: string): string {
  if (kind === "flow") return "#ffffff";
  if (kind === "signal") return "#f59e0b";
  return "#06b6d4";
}

export function variableDotColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("float") || t.includes("number") || t.includes("int")) return "bg-green-500";
  if (t.includes("bool")) return "bg-red-500";
  if (t.includes("vector") || t.includes("vec")) return "bg-yellow-500";
  return "bg-slate-500";
}
