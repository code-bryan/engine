import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { GRAPH_NODE_LIBRARY, getComponentDefinitions, type ComponentDefinition, type GraphNodeSpec } from "@engine/runtime";
import { fetchGraphAsset, saveGraphAsset, type GraphAsset } from "./graph-asset";
import { clamp, computeGraphBounds, createGraphNode, edgeKey, fitGraphView, formatEditableValue, getGraphPortPoint, moveGraphNode, parseEditableValue, toGraphPoint } from "./graph-math";
import { blueprintNodeAccent, portDotClass, variableDotColor, wireColor } from "./accents";

const GRAPH_ZOOM_SENSITIVITY = 2.5;

export type BlueprintViewProps = { path: string; keyboardLocked: boolean };

export function BlueprintView(props: BlueprintViewProps) {
  const [graph, setGraphState] = useState<GraphAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [bounds, setBounds] = useState({ x: 0, y: 0, width: 960, height: 540 });
  const graphRef = useRef<GraphAsset | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const portRefs = useRef(new Map<string, HTMLSpanElement>());
  const [portPoints, setPortPoints] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | undefined>();
  const [graphView, setGraphView] = useState({ x: 0, y: 0, zoom: 1 });
  const graphViewRef = useRef(graphView);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const panState = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const dragState = useRef<{ nodeId: string; pointerId: number; sourceGraph: GraphAsset; startPoint: { x: number; y: number } } | null>(null);

  const setGraph = (next: GraphAsset | null) => { graphRef.current = next; setGraphState(next); };
  const updateGraph = (next: GraphAsset) => { setGraph(next); void saveGraphAsset(props.path, next); };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(undefined);
    setGraph(null);
    fetchGraphAsset(props.path)
      .then((g) => {
        if (!alive) return;
        setGraph(g);
        setError(g ? undefined : "graph not found");
        if (g) {
          setBounds(computeGraphBounds(g));
          setSelectedNodeId(g.entrypoint);
        }
      })
      .catch(() => { if (alive) { setGraph(null); setError("failed to load graph"); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [props.path]);

  useEffect(() => { graphViewRef.current = graphView; }, [graphView]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !graphRef.current) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setGraphView(fitGraphView(rect.width, rect.height, bounds));
  }, [bounds]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !graphRef.current || !viewport) return;
    const measure = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const { x: viewX, y: viewY, zoom } = graphViewRef.current;
      const next: Record<string, { x: number; y: number }> = {};
      for (const [key, element] of portRefs.current) {
        const rect = element.getBoundingClientRect();
        next[key] = {
          x: (rect.left - viewportRect.left + rect.width / 2 - viewX) / zoom,
          y: (rect.top - viewportRect.top + rect.height / 2 - viewY) / zoom,
        };
      }
      setPortPoints(next);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(canvas);
    for (const element of portRefs.current.values()) resizeObserver.observe(element);
    return () => { cancelAnimationFrame(raf); resizeObserver.disconnect(); };
  }, [graph, bounds, graphView]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pan = panState.current;
      if (pan && event.pointerId === pan.pointerId) {
        setGraphView({ x: pan.viewX + (event.clientX - pan.startX), y: pan.viewY + (event.clientY - pan.startY), zoom: graphViewRef.current.zoom });
        return;
      }
      const drag = dragState.current;
      const currentGraph = graphRef.current;
      if (!drag || !currentGraph || event.pointerId !== drag.pointerId) return;
      const currentPoint = toGraphPoint(viewportRef.current, graphViewRef.current, event.clientX, event.clientY);
      if (!currentPoint) return;
      const nextGraph = moveGraphNode(drag.sourceGraph, drag.nodeId, currentPoint.x - drag.startPoint.x, currentPoint.y - drag.startPoint.y);
      setGraph(nextGraph);
    };
    const finishDrag = (event: PointerEvent) => {
      const pan = panState.current;
      if (pan && event.pointerId === pan.pointerId) { panState.current = null; return; }
      const drag = dragState.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragState.current = null;
      const g = graphRef.current;
      if (g) void saveGraphAsset(props.path, g);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [props.path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const t = event.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (selectedEdgeKey) { deleteEdge(selectedEdgeKey); return; }
      if (selectedNodeId) deleteNode(selectedNodeId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEdgeKey, selectedNodeId]);

  const nodeMap = new Map(graph?.nodes.map((node) => [node.id, node]) ?? []);
  const selectedNode = selectedNodeId ? graph?.nodes.find((node) => node.id === selectedNodeId) : undefined;
  const selectedSpec = selectedNode ? GRAPH_NODE_LIBRARY.find((s) => s.type === selectedNode.type) : undefined;

  const handleGraphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!graphRef.current || !(target instanceof Element)) return;
    if (target.closest(".blueprint-node")) return;
    if (!(event.button === 1 || (event.button === 0 && (event.altKey || event.metaKey)))) return;
    event.preventDefault();
    panState.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: graphViewRef.current.x, viewY: graphViewRef.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleGraphWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const wx = (cx - graphViewRef.current.x) / graphViewRef.current.zoom;
    const wy = (cy - graphViewRef.current.y) / graphViewRef.current.zoom;
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 240 : 1);
    const factor = Math.exp(-delta * 0.0015 * Math.pow(GRAPH_ZOOM_SENSITIVITY, 1.2));
    const nextZoom = clamp(graphViewRef.current.zoom * factor, 0.2, 3);
    setGraphView({ x: cx - wx * nextZoom, y: cy - wy * nextZoom, zoom: nextZoom });
  };

  const zoomGraph = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wx = (cx - graphViewRef.current.x) / graphViewRef.current.zoom;
    const wy = (cy - graphViewRef.current.y) / graphViewRef.current.zoom;
    const nextZoom = clamp(graphViewRef.current.zoom * factor, 0.2, 3);
    setGraphView({ x: cx - wx * nextZoom, y: cy - wy * nextZoom, zoom: nextZoom });
  };

  const fitView = () => {
    const viewport = viewportRef.current;
    setGraphView(fitGraphView(viewport?.clientWidth ?? 1400, viewport?.clientHeight ?? 900, bounds));
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const startPoint = toGraphPoint(viewportRef.current, graphViewRef.current, event.clientX, event.clientY);
    if (!startPoint) return;
    setSelectedNodeId(nodeId);
    setSelectedEdgeKey(undefined);
    dragState.current = { nodeId, pointerId: event.pointerId, sourceGraph: currentGraph, startPoint };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  function deleteNode(nodeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const nextNodes = currentGraph.nodes.filter((node) => node.id !== nodeId);
    const nextGraph = {
      ...currentGraph,
      nodes: nextNodes,
      edges: currentGraph.edges.filter((edge) => edge.from.node !== nodeId && edge.to.node !== nodeId),
      entrypoint: currentGraph.entrypoint === nodeId ? (nextNodes[0]?.id ?? currentGraph.entrypoint) : currentGraph.entrypoint,
    };
    updateGraph(nextGraph);
    setSelectedNodeId((current) => (current === nodeId ? nextGraph.nodes[0]?.id : current));
  }

  function deleteEdge(edgeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    updateGraph({ ...currentGraph, edges: currentGraph.edges.filter((edge) => edgeKey(edge) !== edgeId) });
    setSelectedEdgeKey((current) => (current === edgeId ? undefined : current));
  }

  const addNode = (spec: GraphNodeSpec) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const node = createGraphNode(spec, { x: bounds.x + 180 + currentGraph.nodes.length * 18, y: bounds.y + 160 + currentGraph.nodes.length * 12 });
    updateGraph({ ...currentGraph, nodes: [...currentGraph.nodes, node] });
    setSelectedNodeId(node.id);
  };

  const updateNodeData = (nodeId: string, field: string, nextValue: string, type: GraphNodeSpec["fields"][number]["type"]) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const parsed = parseEditableValue(nextValue, type);
    updateGraph({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...(node.data ?? {}), [field]: parsed } } : node),
    });
  };

  const addVariable = () => {
    const currentGraph = graphRef.current;
    if (!currentGraph || props.keyboardLocked) return;
    updateGraph({ ...currentGraph, variables: [...currentGraph.variables, { name: `Var${currentGraph.variables.length + 1}`, scope: "private", type: "float", default: 0 }] });
  };

  const filteredLibrary = GRAPH_NODE_LIBRARY.filter((spec) => `${spec.label} ${spec.type}`.toLowerCase().includes(paletteQuery.trim().toLowerCase()));
  const componentDefs: ComponentDefinition[] = getComponentDefinitions();

  return (
    <div className="absolute inset-0 z-40 flex pointer-events-auto text-xs">
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden blueprint-grid">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-20 flex bg-black/60 backdrop-blur border border-white/10 rounded overflow-hidden">
          <button className="px-3 py-1.5 text-[#ccc] hover:text-white hover:bg-black/80 transition-all font-medium flex items-center gap-1" onClick={() => setPaletteOpen((open) => !open)} title="Find / add node">
            <i className="ph-fill ph-magnifying-glass text-[#888]" /> Find
          </button>
        </div>
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-20 flex bg-black/60 backdrop-blur border border-white/10 rounded overflow-hidden">
          <button className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white hover:bg-black/80 border-r border-white/10" onClick={() => zoomGraph(1 / 1.18)} title="Zoom out"><i className="ph ph-minus" /></button>
          <button className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white hover:bg-black/80 border-r border-white/10" onClick={fitView} title="Fit"><i className="ph ph-arrows-in" /></button>
          <button className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white hover:bg-black/80" onClick={() => zoomGraph(1.18)} title="Zoom in"><i className="ph ph-plus" /></button>
        </div>
        {/* Find popover */}
        {paletteOpen && (
          <div className="absolute top-12 left-3 z-30 w-60 bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col overflow-hidden">
            <div className="p-2 border-b border-[#303030]">
              <input autoFocus className="engine-input w-full px-2 py-1 rounded" placeholder="search nodes" value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredLibrary.map((spec) => (
                <button key={spec.type} className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white flex justify-between gap-2" onClick={() => { addNode(spec); setPaletteOpen(false); setPaletteQuery(""); }}>
                  <span className="truncate">{spec.label}</span><span className="text-[#666] shrink-0">{spec.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {loading && <div className="absolute inset-0 grid place-items-center text-[#666]">loading graph…</div>}
        {error && <div className="absolute inset-0 grid place-items-center text-[#666]">{error}</div>}
        {graph && !loading && !error && (
          <div ref={viewportRef} className="absolute inset-0 overflow-hidden" onPointerDown={handleGraphPointerDown} onWheel={handleGraphWheel}>
            <div ref={canvasRef} className="absolute top-0 left-0" style={{ width: `${bounds.width}px`, height: `${bounds.height}px`, transform: `translate(${graphView.x}px, ${graphView.y}px) scale(${graphView.zoom})`, transformOrigin: "0 0" }}>
              <svg className="absolute top-0 left-0 pointer-events-none" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
                {graph.edges.map((edge, index) => {
                  const from = nodeMap.get(edge.from.node);
                  const to = nodeMap.get(edge.to.node);
                  if (!from || !to) return null;
                  const id = edgeKey(edge);
                  const spec = GRAPH_NODE_LIBRARY.find((s) => s.type === from.type);
                  const kind = spec?.outputs.find((p) => p.name === edge.from.port)?.kind ?? "data";
                  const fromPoint = portPoints[`${edge.from.node}:output:${edge.from.port}`] ?? getGraphPortPoint(from, edge.from.port, "output", bounds);
                  const toPoint = portPoints[`${edge.to.node}:input:${edge.to.port}`] ?? getGraphPortPoint(to, edge.to.port, "input", bounds);
                  const mid = (fromPoint.x + toPoint.x) / 2;
                  return (
                    <path
                      key={`${id}-${index}`}
                      d={`M ${fromPoint.x} ${fromPoint.y} C ${mid} ${fromPoint.y}, ${mid} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`}
                      fill="none"
                      stroke={wireColor(kind)}
                      strokeWidth={selectedEdgeKey === id ? 3.5 : 2.5}
                      opacity={selectedEdgeKey === id ? 1 : 0.85}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() => { setSelectedEdgeKey(id); setSelectedNodeId(undefined); }}
                    />
                  );
                })}
              </svg>
              {graph.nodes.map((node) => {
                const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === node.type);
                const accent = blueprintNodeAccent(node.type);
                const isSelected = node.id === selectedNodeId;
                const flowFirst = <T extends { kind: string }>(ports: readonly T[]) =>
                  [...ports].sort((a, b) => (a.kind === "flow" ? 0 : 1) - (b.kind === "flow" ? 0 : 1));
                const inputs = flowFirst(spec?.inputs ?? []);
                const outputs = flowFirst(spec?.outputs ?? []);
                return (
                  <div
                    key={node.id}
                    className={`blueprint-node absolute w-48 bg-[#1e1e1e]/95 backdrop-blur-sm rounded-md shadow-2xl flex flex-col font-sans text-[11px] ${isSelected ? "ring-2 ring-[#0070e0]" : "border border-black"}`}
                    style={{ left: `${node.position.x - bounds.x}px`, top: `${node.position.y - bounds.y}px` }}
                    onPointerDown={(event) => beginDrag(event, node.id)}
                    onClick={() => { setSelectedNodeId(node.id); setSelectedEdgeKey(undefined); }}
                  >
                    <div className={`h-7 rounded-t-md flex items-center px-2 text-white font-bold tracking-wide border-b border-black bg-gradient-to-r ${accent.grad}`}>
                      <i className={`${accent.icon} mr-1 text-base opacity-80`} /> <span className="truncate flex-1">{spec?.label ?? node.type}</span>
                      <button
                        className="ml-1 text-white/70 hover:text-white"
                        title="Delete node"
                        disabled={props.keyboardLocked}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); deleteNode(node.id); }}
                      >
                        <i className="ph ph-x text-xs" />
                      </button>
                    </div>
                    <div className="p-2 py-3 flex justify-between gap-2">
                      <div className="space-y-2">
                        {inputs.map((port) => (
                          <div key={`in-${port.name}`} className="flex items-center gap-1.5 group">
                            <span
                              className={portDotClass(port.kind)}
                              ref={(el) => { const k = `${node.id}:input:${port.name}`; if (el) portRefs.current.set(k, el); else portRefs.current.delete(k); }}
                            />
                            <span className="text-[#ccc] group-hover:text-white">{port.label ?? port.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 text-right">
                        {outputs.map((port) => (
                          <div key={`out-${port.name}`} className="flex items-center justify-end gap-1.5 group">
                            <span className="text-[#ccc] group-hover:text-white">{port.label ?? port.name}</span>
                            <span
                              className={portDotClass(port.kind)}
                              ref={(el) => { const k = `${node.id}:output:${port.name}`; if (el) portRefs.current.set(k, el); else portRefs.current.delete(k); }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {spec && spec.fields.length > 0 && (
                      <div className="px-2 pb-2 space-y-1.5">
                        {spec.fields.map((field) => {
                          const selectCls = "flex-1 min-w-0 bg-[#000] border border-[#303030] text-[9px] px-1 py-0.5 rounded text-[#ccc]";
                          const targetDef = componentDefs.find((d) => d.id === String(node.data?.component ?? ""));
                          const isComponentField = field.name === "component";
                          const isEnumValueField = node.type === "SetComponent" && field.name === "value" && targetDef?.kind === "enum" && (targetDef.values?.length ?? 0) > 0;
                          return (
                          <div key={field.name} className="flex items-center gap-1.5">
                            <span className="text-[#888] w-14 truncate">{field.label}</span>
                            {isComponentField ? (
                              <select
                                className={selectCls}
                                value={String(node.data?.component ?? "")}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, event.target.value, field.type)}
                              >
                                <option value="">—</option>
                                {componentDefs.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
                                {Boolean(node.data?.component) && !componentDefs.some((d) => d.id === node.data?.component) && <option value={String(node.data?.component)}>{String(node.data?.component)}</option>}
                              </select>
                            ) : isEnumValueField ? (
                              <select
                                className={selectCls}
                                value={String(node.data?.value ?? "")}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, event.target.value, field.type)}
                              >
                                {(targetDef?.values ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : field.type === "boolean" ? (
                              <input
                                type="checkbox"
                                className="accent-[#0070e0]"
                                checked={String(node.data?.[field.name] ?? "") === "true"}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, String(event.target.checked), field.type)}
                              />
                            ) : (
                              <input
                                type="text"
                                className="flex-1 min-w-0 bg-[#000] border border-[#303030] text-[9px] px-1 py-0.5 rounded text-center text-[#888]"
                                value={formatEditableValue(node.data?.[field.name], field.type)}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, event.target.value, field.type)}
                              />
                            )}
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: System Variables + Node Details */}
      <aside className="w-72 bg-[#1e1e1e] border-l border-[#303030] flex flex-col flex-shrink-0 shadow-xl">
        <div className="flex-1 flex flex-col border-b border-[#303030] min-h-[40%]">
          <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] justify-between text-white font-medium select-none">
            System Variables
            <i className="ph ph-plus text-[#888] hover:text-white cursor-pointer" title="Add Variable" onClick={addVariable} />
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 select-none space-y-1">
            {graph && graph.variables.length > 0 ? graph.variables.map((variable, index) => (
              <div key={`${variable.name}-${index}`} className="flex items-center justify-between px-2 py-1 hover:bg-[#2d2d2d] cursor-pointer rounded text-[#ccc] group">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${variableDotColor(variable.type)}`} />
                  {variable.name}
                </div>
                <span className="text-[10px] text-[#888] bg-[#111] px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">{variable.type}</span>
              </div>
            )) : <div className="text-[#666] px-2 py-1">no variables</div>}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[40%]">
          <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none">Node Details</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {selectedNode ? (
              <>
                <div className="flex items-center gap-2 pb-2 border-b border-[#303030]">
                  <i className={`${blueprintNodeAccent(selectedNode.type).icon} ${blueprintNodeAccent(selectedNode.type).text} text-lg`} />
                  <div className="font-medium text-white">{selectedSpec?.label ?? selectedNode.type}</div>
                </div>
                <div className="space-y-3">
                  {selectedSpec && selectedSpec.fields.length > 0 ? selectedSpec.fields.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">{field.label}</span>
                      {field.type === "boolean" ? (
                        <input
                          type="checkbox"
                          className="accent-[#0070e0] w-3.5 h-3.5"
                          checked={String(selectedNode.data?.[field.name] ?? "") === "true"}
                          disabled={props.keyboardLocked}
                          onChange={(event) => updateNodeData(selectedNode.id, field.name, String(event.target.checked), field.type)}
                        />
                      ) : (
                        <input
                          className="w-full engine-input px-2 py-1.5 rounded text-white text-xs"
                          value={formatEditableValue(selectedNode.data?.[field.name], field.type)}
                          disabled={props.keyboardLocked}
                          onChange={(event) => updateNodeData(selectedNode.id, field.name, event.target.value, field.type)}
                        />
                      )}
                    </div>
                  )) : <div className="text-[#666]">no settings</div>}
                  <div className="text-[10px] text-[#666] pt-1 break-all">id: {selectedNode.id}</div>
                </div>
              </>
            ) : <div className="text-[#666]">select a node</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}
