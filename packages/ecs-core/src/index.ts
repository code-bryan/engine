export type Entity = number;
export type SystemFn = (dt: number) => void;
export type WorldDebugEvent =
  | { type: "entity:spawn"; frame: number; entity: Entity }
  | { type: "entity:destroy"; frame: number; entity: Entity }
  | { type: "tag:add"; frame: number; entity: Entity; tag: string }
  | { type: "tag:remove"; frame: number; entity: Entity; tag: string }
  | { type: "system:add"; frame: number; index: number; label: string }
  | { type: "frame:start"; frame: number; dt: number }
  | { type: "system:run"; frame: number; dt: number; index: number; label: string; durationMs: number }
  | { type: "frame:end"; frame: number; dt: number; durationMs: number };
export type WorldDebugListener = (event: WorldDebugEvent) => void;

type SystemEntry = {
  label: string;
  run: SystemFn;
};

export interface ComponentStore<T> extends Map<Entity, T> {}
export const createStore = <T>() => new Map<Entity, T>() as ComponentStore<T>;

export class Tags<TTag extends string = string> {
  private stores = new Map<TTag, Set<Entity>>();

  constructor(private readonly emit?: (event: WorldDebugEvent) => void, private readonly getFrame?: () => number) {}

  add(e: Entity, ...tags: TTag[]) {
    for (const tag of tags) {
      const store = this.stores.get(tag) ?? new Set<Entity>();
      store.add(e);
      this.stores.set(tag, store);
      this.emit?.({ type: "tag:add", frame: this.getFrame?.() ?? 0, entity: e, tag });
    }
  }

  remove(e: Entity, ...tags: TTag[]) {
    for (const tag of tags) {
      this.stores.get(tag)?.delete(e);
      this.emit?.({ type: "tag:remove", frame: this.getFrame?.() ?? 0, entity: e, tag });
    }
  }

  has(e: Entity, tag: TTag) {
    return this.stores.get(tag)?.has(e) ?? false;
  }

  all(e: Entity, ...tags: TTag[]) {
    return tags.every((tag) => this.has(e, tag));
  }

  any(e: Entity, ...tags: TTag[]) {
    return tags.some((tag) => this.has(e, tag));
  }

  with(tag: TTag) {
    return this.stores.get(tag) ?? new Set<Entity>();
  }

  list(e: Entity) {
    const tags: TTag[] = [];
    for (const [tag, store] of this.stores) {
      if (store.has(e)) tags.push(tag);
    }
    return tags;
  }
}

export class World {
  private next = 0;
  private frame = 0;
  private debugListeners = new Set<WorldDebugListener>();
  private systemEntries: SystemEntry[] = [];
  entities = new Set<Entity>();
  tags = new Tags((event) => this.emitDebug(event), () => this.frame);
  systems: SystemFn[] = [];

  getFrame() {
    return this.frame;
  }

  getSystemEntries() {
    return this.systemEntries.slice();
  }

  onDebugEvent(listener: WorldDebugListener) {
    this.debugListeners.add(listener);
    return () => this.debugListeners.delete(listener);
  }

  spawn(): Entity {
    const id = this.next++;
    this.entities.add(id);
    this.emitDebug({ type: "entity:spawn", frame: this.frame, entity: id });
    return id;
  }

  destroy(e: Entity) {
    this.entities.delete(e);
    this.emitDebug({ type: "entity:destroy", frame: this.frame, entity: e });
  }

  addSystem(labelOrFn: string | SystemFn, maybeFn?: SystemFn) {
    const run = typeof labelOrFn === "function" ? labelOrFn : maybeFn;
    if (!run) throw new Error("system function is required");

    const label = typeof labelOrFn === "string"
      ? labelOrFn
      : labelOrFn.name || `system_${this.systemEntries.length}`;

    const entry = { label, run };
    this.systemEntries.push(entry);
    this.systems.push(run);
    this.emitDebug({
      type: "system:add",
      frame: this.frame,
      index: this.systemEntries.length - 1,
      label,
    });
  }

  tick(dt: number) {
    const frame = ++this.frame;
    const frameStartedAt = performance.now();
    this.emitDebug({ type: "frame:start", frame, dt });

    for (let index = 0; index < this.systemEntries.length; index += 1) {
      const entry = this.systemEntries[index];
      const startedAt = performance.now();
      entry.run(dt);
      this.emitDebug({
        type: "system:run",
        frame,
        dt,
        index,
        label: entry.label,
        durationMs: performance.now() - startedAt,
      });
    }

    this.emitDebug({
      type: "frame:end",
      frame,
      dt,
      durationMs: performance.now() - frameStartedAt,
    });
  }

  private emitDebug(event: WorldDebugEvent) {
    for (const listener of this.debugListeners) listener(event);
  }
}
