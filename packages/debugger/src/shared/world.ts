export type WorldEntityBase = {
  kind: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
};

export type WorldData<T extends WorldEntityBase = WorldEntityBase> = {
  version: 1;
  entities: T[];
};
