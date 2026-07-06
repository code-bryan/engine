import { registerComponent, type ComponentStore } from "@engine/ecs-core";

export type ComponentDefinition = {
  version: 1;
  id: string;
  label: string;
  defaultValue?: unknown;
};

const componentModules = import.meta.glob("./**/*.json", { eager: true, import: "default" }) as Record<string, unknown>;

const componentDefinitions = Object.values(componentModules)
  .map(parseComponentDefinition)
  .sort((left, right) => left.id.localeCompare(right.id));

const componentStores = new Map<string, ComponentStore<unknown>>();

for (const definition of componentDefinitions) {
  if (componentStores.has(definition.id)) {
    throw new Error(`duplicate component id: ${definition.id}`);
  }
  componentStores.set(definition.id, registerComponent(definition.id, definition.label, new Map()));
}

export function getComponentDefinitions() {
  return componentDefinitions.slice();
}

export function getComponentStore<T>(id: string): ComponentStore<T> {
  const store = componentStores.get(id);
  if (!store) throw new Error(`missing component store: ${id}`);
  return store as ComponentStore<T>;
}

function parseComponentDefinition(value: unknown): ComponentDefinition {
  if (!value || typeof value !== "object") throw new Error("invalid component definition");
  const parsed = value as Partial<ComponentDefinition>;
  if (parsed.version !== 1) throw new Error("invalid component definition version");
  if (typeof parsed.id !== "string" || parsed.id.trim() === "") throw new Error("invalid component id");
  if (typeof parsed.label !== "string" || parsed.label.trim() === "") throw new Error(`invalid component label for ${parsed.id}`);
  return {
    version: 1,
    id: parsed.id,
    label: parsed.label,
    defaultValue: parsed.defaultValue,
  };
}
