import type { SystemFn } from "@engine/ecs-core";
import { createGraphSystem, loadGraphDefinition } from "./graphs";
import type { DemoGameWorld } from "./types";

export type RuntimeContentTreeNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "prefab" | "component" | "graph";
  children?: RuntimeContentTreeNode[];
};

export type RuntimeGraphSystem = {
  name: string;
  run: SystemFn;
};

export async function loadGraphSystems(world: DemoGameWorld): Promise<RuntimeGraphSystem[]> {
  const tree = await fetchContentTree();
  const graphNames = collectGraphNames(tree);
  const graphs = await Promise.all(graphNames.map(async (name) => loadGraphDefinition(name)));
  const systems = graphs
    .filter((graph): graph is NonNullable<typeof graph> => graph !== null)
    .sort((left, right) => (left.metadata?.order ?? Number.POSITIVE_INFINITY) - (right.metadata?.order ?? Number.POSITIVE_INFINITY) || left.name.localeCompare(right.name))
    .map(async (graph) => ({
      name: graph.name,
      run: await createGraphSystem(world, graph),
    }));
  return Promise.all(systems);
}

export async function registerGraphSystems(world: DemoGameWorld) {
  for (const system of await loadGraphSystems(world)) {
    world.addSystem(system.name, system.run);
  }
}

async function fetchContentTree(): Promise<RuntimeContentTreeNode[]> {
  const response = await fetch("/api/content/tree");
  if (!response.ok) return [];
  return await response.json() as RuntimeContentTreeNode[];
}

function collectGraphNames(nodes: RuntimeContentTreeNode[]): string[] {
  const names: string[] = [];
  for (const node of nodes) {
    if (node.kind === "graph" && node.path.startsWith("systems/")) {
      names.push(node.path.replace(/^systems\//, ""));
    }
    if (node.children?.length) {
      names.push(...collectGraphNames(node.children));
    }
  }
  return names;
}
