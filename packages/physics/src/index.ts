import Matter from "matter-js";
import { createStore, type ComponentStore, type Entity } from "@engine/ecs-core";
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

export class Physics {
  private engine: Matter.Engine;
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
  }

  setVelocity(entity: Entity, velocity: { x: number; y: number }) {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody || rigidBody.kind === "static") return;
    Matter.Body.setVelocity(rigidBody.body, {
      x: velocity.x / 60,
      y: velocity.y / 60,
    });
  }

  reset(entity: Entity, position: { x: number; y: number }, velocity = { x: 0, y: 0 }) {
    const rigidBody = this.rigidBodies.get(entity);
    if (!rigidBody) return;

    Matter.Body.setPosition(rigidBody.body, {
      x: position.x + rigidBody.width / 2,
      y: position.y + rigidBody.height / 2,
    });
    Matter.Body.setVelocity(rigidBody.body, velocity);
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

  private findEntityByBody(body: Matter.Body) {
    for (const [entity, rigidBody] of this.rigidBodies) {
      if (rigidBody.body === body) return entity;
    }
  }
}

export const createPhysics = (options?: PhysicsOptions) => new Physics(options);
