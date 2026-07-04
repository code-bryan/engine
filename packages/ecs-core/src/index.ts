export type Entity = number;

export interface ComponentStore<T> extends Map<Entity, T> {}
export const createStore = <T>() => new Map<Entity, T>() as ComponentStore<T>;

export class Tags<TTag extends string = string> {
  private stores = new Map<TTag, Set<Entity>>();

  add(e: Entity, ...tags: TTag[]) {
    for (const tag of tags) {
      const store = this.stores.get(tag) ?? new Set<Entity>();
      store.add(e);
      this.stores.set(tag, store);
    }
  }

  remove(e: Entity, ...tags: TTag[]) {
    for (const tag of tags) this.stores.get(tag)?.delete(e);
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
}

export class World {
  private next = 0;
  entities = new Set<Entity>();
  tags = new Tags();
  systems: ((dt: number) => void)[] = [];

  spawn(): Entity { const id = this.next++; this.entities.add(id); return id; }
  destroy(e: Entity) { this.entities.delete(e); }
  addSystem(fn: (dt: number) => void) { this.systems.push(fn); }
  tick(dt: number) { for (const s of this.systems) s(dt); }
}
