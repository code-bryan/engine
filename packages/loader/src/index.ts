import type { World } from "@engine/ecs-core";

export type Prefab<T = unknown> = (world: World, props: T) => void;
export type HotReloadHook = () => void;

const hooks = new Set<HotReloadHook>();

export function definePrefab<T>(fn: Prefab<T>) {
  return fn;
}

export function onHotReload(hook: HotReloadHook) {
  hooks.add(hook);
  return () => hooks.delete(hook);
}

export function emitHotReload() {
  for (const hook of hooks) hook();
}
