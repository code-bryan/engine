export type Entity = number;

export interface ComponentStore<T> extends Map<Entity, T> {}
export const createStore = <T>() => new Map<Entity, T>() as ComponentStore<T>;

export class World {
  private next = 0;
  entities = new Set<Entity>();
  systems: ((dt: number) => void)[] = [];

  spawn(): Entity { const id = this.next++; this.entities.add(id); return id; }
  destroy(e: Entity) { this.entities.delete(e); }
  addSystem(fn: (dt: number) => void) { this.systems.push(fn); }
  tick(dt: number) { for (const s of this.systems) s(dt); }
}
