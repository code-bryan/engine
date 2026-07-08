import Matter from "matter-js";
import { createStore, type ComponentStore, type Entity, type World } from "@engine/ecs-core";
import { transforms } from "@engine/renderer";

export type RigidBodyKind = "dynamic" | "kinematic" | "static";

export type PhysicsOptions = {
  gravity?: { x: number; y: number };
};

export type RigidBody = {
  body: Matter.Body;
  kind: RigidBodyKind;
  width: number;
  height: number;
};

export type RigidBodyBoxProps = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhysicsDebugBody = {
  entity: Entity;
  kind: RigidBodyKind;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  isColliding: boolean;
};

export type PhysicsDebugEvent =
  | { type: "body:set"; entity: Entity; kind: RigidBodyKind; x: number; y: number; width: number; height: number }
  | { type: "body:reset"; entity: Entity; x: number; y: number; velocity: { x: number; y: number } }
  | { type: "body:angle"; entity: Entity; angle: number }
  | { type: "body:velocity"; entity: Entity; velocity: { x: number; y: number } }
  | { type: "collision:start"; entities: [Entity, Entity] }
  | { type: "collision:end"; entities: [Entity, Entity] };
export type PhysicsDebugListener = (event: PhysicsDebugEvent) => void;

export type CollisionRecord = { seq: number; type: "start" | "end"; other: Entity };
export type ContactInfo = { normal: { x: number; y: number }; points: Array<{ x: number; y: number }> };

export class Physics {
  private engine: Matter.Engine;
  private collisions = new Set<string>();
  private debugListeners = new Set<PhysicsDebugListener>();
  private collisionSeq = 0;
  private collisionHistory = new Map<Entity, CollisionRecord[]>();
  rigidBodies: ComponentStore<RigidBody> = createStore<RigidBody>();

  body = {
    dynamic: {
      set: (entity: Entity, props: RigidBodyBoxProps) => this.setBody(entity, { ...props, kind: "dynamic" }),
    },
    kinematic: {
      set: (entity: Entity, props: RigidBodyBoxProps) => this.setBody(entity, { ...props, kind: "kinematic" }),
    },
    static: {
      set: (entity: Entity, props: RigidBodyBoxProps) => this.setBody(entity, { ...props, kind: "static" }),
    },
  };

  constructor(options: PhysicsOptions = {}) {
    this.engine = Matter.Engine.create({
      gravity: options.gravity,
    });

    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) this.trackCollision(pair.bodyA, pair.bodyB);
    });
    Matter.Events.on(this.engine, "collisionEnd", (event) => {
      for (const pair of event.pairs) this.untrackCollision(pair.bodyA, pair.bodyB);
    });
  }

  onDebugEvent(listener: PhysicsDebugListener) {
    this.debugListeners.add(listener);
    return () => this.debugListeners.delete(listener);
  }

  // Remove every body from the Matter world and clear collision state, so the same
  // Physics instance can be reused for a freshly materialized world (keeps listeners).
  clearBodies() {
    for (const rigidBody of this.rigidBodies.values()) {
      Matter.Composite.remove(this.engine.world, rigidBody.body);
    }
    this.rigidBodies.clear();
    this.collisions.clear();
    this.collisionHistory.clear();
    this.collisionSeq = 0;
  }

  setBody(entity: Entity, props: RigidBodyBoxProps & { kind?: RigidBodyKind }) {
    const kind = props.kind ?? "dynamic";
    const body = Matter.Bodies.rectangle(
      props.x + props.width / 2,
      props.y + props.height / 2,
      props.width,
      props.height,
      {
        isStatic: kind === "static",
        isSensor: kind === "kinematic",
        inertia: Infinity,
      },
    );

    Matter.Composite.add(this.engine.world, body);
    this.rigidBodies.set(entity, { body, kind, width: props.width, height: props.height });
    this.emitDebug({
      type: "body:set",
      entity,
      kind,
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
    });
  }

  setVelocity(entity: Entity, velocity: { x: number; y: number }) {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody || rigidBody.kind === "static") return;
    Matter.Body.setVelocity(rigidBody.body, {
      x: velocity.x / 60,
      y: velocity.y / 60,
    });
    this.emitDebug({ type: "body:velocity", entity, velocity: { ...velocity } });
  }

  reset(entity: Entity, position: { x: number; y: number }, velocity = { x: 0, y: 0 }) {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody) return;

    Matter.Body.setPosition(rigidBody.body, {
      x: position.x + rigidBody.width / 2,
      y: position.y + rigidBody.height / 2,
    });
    Matter.Body.setVelocity(rigidBody.body, velocity);
    this.emitDebug({ type: "body:reset", entity, x: position.x, y: position.y, velocity: { ...velocity } });
  }

  setAngle(entity: Entity, angle: number) {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody) return;
    Matter.Body.setAngle(rigidBody.body, angle);
    this.emitDebug({ type: "body:angle", entity, angle });
  }

  createSystem() {
    return (dt: number) => {
      Matter.Engine.update(this.engine, Math.min(dt, 1 / 30) * 1000);

      for (const [e, rigidBody] of this.rigidBodies) {
        const transform = transforms.get(e);
        if (!transform) continue;

        transform.x = rigidBody.body.position.x - rigidBody.width / 2;
        transform.y = rigidBody.body.position.y - rigidBody.height / 2;
        transform.rotation = rigidBody.body.angle;
      }
    };
  }

  onCollisionStart(callback: (a: Entity, b: Entity) => void) {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        const a = this.findEntityByBody(pair.bodyA);
        const b = this.findEntityByBody(pair.bodyB);
        if (a === undefined || b === undefined) continue;
        callback(a, b);
      }
    });
  }

  collidesWith(world: World, entity: Entity, tag: string) {
    for (const other of world.tags.with(tag)) {
      if (this.collides(entity, other)) return true;
    }
    return false;
  }

  collider(world: World, entity: Entity) {
    return {
      collide: (tag: string) => this.collidesWith(world, entity, tag),
    };
  }

  getDebugBodies(): PhysicsDebugBody[] {
    return Array.from(this.rigidBodies, ([entity, rigidBody]) => ({
      entity,
      kind: rigidBody.kind,
      x: rigidBody.body.position.x - rigidBody.width / 2,
      y: rigidBody.body.position.y - rigidBody.height / 2,
      width: rigidBody.width,
      height: rigidBody.height,
      angle: rigidBody.body.angle,
      isColliding: this.isEntityColliding(entity),
    }));
  }

  getDebugBody(entity: Entity) {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody) return undefined;
    return this.toDebugBody(entity, rigidBody);
  }

  getCollidingEntities(entity: Entity) {
    const entities: Entity[] = [];

    for (const key of this.collisions) {
      const [left, right] = key.split(":").map(Number);
      if (left === entity) entities.push(right);
      else if (right === entity) entities.push(left);
    }

    return entities;
  }

  getCollisionHistory(entity: Entity): CollisionRecord[] {
    return this.collisionHistory.get(entity) ?? [];
  }

  getContactNormals(entity: Entity): ContactInfo[] {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody) return [];

    const pairs = (this.engine as unknown as { pairs: { list: Matter.Pair[] } }).pairs?.list;
    if (!pairs) return [];

    const result: ContactInfo[] = [];
    for (const pair of pairs) {
      if (!pair.isActive) continue;
      if (pair.bodyA !== rigidBody.body && pair.bodyB !== rigidBody.body) continue;
      result.push({
        normal: { x: pair.collision.normal.x, y: pair.collision.normal.y },
        points: (pair.activeContacts ?? []).map((c) => ({ x: c.vertex.x, y: c.vertex.y })),
      });
    }
    return result;
  }

  pickEntityAt(point: { x: number; y: number }) {
    for (const [entity, rigidBody] of this.rigidBodies) {
      const { x, y, width, height } = this.toDebugBody(entity, rigidBody);
      if (
        point.x >= x &&
        point.x <= x + width &&
        point.y >= y &&
        point.y <= y + height
      ) {
        return entity;
      }
    }
  }

  private collides(a: Entity, b: Entity) {
    return this.collisions.has(this.collisionKey(a, b));
  }

  private isEntityColliding(entity: Entity) {
    for (const key of this.collisions) {
      if (key.startsWith(`${entity}:`) || key.endsWith(`:${entity}`)) return true;
    }
    return false;
  }

  private trackCollision(bodyA: Matter.Body, bodyB: Matter.Body) {
    const a = this.findEntityByBody(bodyA);
    const b = this.findEntityByBody(bodyB);
    if (a === undefined || b === undefined) return;
    this.collisions.add(this.collisionKey(a, b));
    this.pushHistory(a, "start", b);
    this.pushHistory(b, "start", a);
    this.emitDebug({ type: "collision:start", entities: [a, b] });
  }

  private untrackCollision(bodyA: Matter.Body, bodyB: Matter.Body) {
    const a = this.findEntityByBody(bodyA);
    const b = this.findEntityByBody(bodyB);
    if (a === undefined || b === undefined) return;
    this.collisions.delete(this.collisionKey(a, b));
    this.pushHistory(a, "end", b);
    this.pushHistory(b, "end", a);
    this.emitDebug({ type: "collision:end", entities: [a, b] });
  }

  private pushHistory(entity: Entity, type: "start" | "end", other: Entity) {
    const seq = this.collisionSeq++;
    const history = this.collisionHistory.get(entity) ?? [];
    history.unshift({ seq, type, other });
    if (history.length > 12) history.length = 12;
    this.collisionHistory.set(entity, history);
  }

  private collisionKey(a: Entity, b: Entity) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  private toDebugBody(entity: Entity, rigidBody: RigidBody): PhysicsDebugBody {
    return {
      entity,
      kind: rigidBody.kind,
      x: rigidBody.body.position.x - rigidBody.width / 2,
      y: rigidBody.body.position.y - rigidBody.height / 2,
      width: rigidBody.width,
      height: rigidBody.height,
      angle: rigidBody.body.angle,
      isColliding: this.isEntityColliding(entity),
    };
  }

  private findEntityByBody(body: Matter.Body) {
    for (const [entity, rigidBody] of this.rigidBodies) {
      if (rigidBody.body === body) return entity;
    }
  }

  private emitDebug(event: PhysicsDebugEvent) {
    for (const listener of this.debugListeners) listener(event);
  }
}

export const createPhysics = (options?: PhysicsOptions) => new Physics(options);
