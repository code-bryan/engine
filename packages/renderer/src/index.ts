import { Application, Container, Sprite, Texture, type ApplicationOptions } from "pixi.js";
import { createStore, type ComponentStore, type Entity, type World } from "@engine/ecs-core";

export type Transform = { x: number; y: number; rotation?: number; scale?: number };
export type SpriteRef = { sprite: Sprite };
export type SpriteProps = { texture?: Texture; tint?: number };

export const transforms = createStore<Transform>();
export const sprites = createStore<SpriteRef>();

export const createSprite = (texture: Texture = Texture.WHITE) => new Sprite(texture);

export function attachSprite(e: Entity, sprite = createSprite()) {
  sprites.set(e, { sprite });
  return sprite;
}

export const sprite = {
  set(entity: Entity, props: SpriteProps = {}) {
    const pixiSprite = createSprite(props.texture);
    if (props.tint !== undefined) pixiSprite.tint = props.tint;
    sprites.set(entity, { sprite: pixiSprite });
    return pixiSprite;
  },
};

export function createRenderSystem(
  stage: Container,
  transformStore: ComponentStore<Transform> = transforms,
  spriteStore: ComponentStore<SpriteRef> = sprites,
) {
  return () => {
    for (const [e, { sprite }] of spriteStore) {
      if (!sprite.parent) stage.addChild(sprite);
      const t = transformStore.get(e);
      if (!t) continue;
      sprite.position.set(t.x, t.y);
      sprite.rotation = t.rotation ?? 0;
      sprite.scale.set(t.scale ?? 1);
    }
  };
}

export type EngineApplicationOptions = {
  world: World;
  mount: HTMLElement;
  pixi?: Partial<ApplicationOptions>;
};

export type EngineApplication = {
  app: Application;
  start: () => void;
  stop: () => void;
};

export async function createEngineApplication(options: EngineApplicationOptions): Promise<EngineApplication> {
  const app = new Application();
  await app.init(options.pixi);
  options.mount.appendChild(app.canvas);

  options.world.addSystem(createRenderSystem(app.stage));

  let frame = 0;
  let last = performance.now();

  function loop(now: number) {
    options.world.tick((now - last) / 1000);
    last = now;
    frame = requestAnimationFrame(loop);
  }

  return {
    app,
    start() {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
