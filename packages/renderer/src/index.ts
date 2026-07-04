import { Application, Assets, Container, Rectangle, Sprite, Texture, type ApplicationOptions } from "pixi.js";
import { createStore, type ComponentStore, type Entity, type World } from "@engine/ecs-core";

export type TransformScale = number | { x: number; y: number };
export type Transform = { x: number; y: number; rotation?: number; scale?: TransformScale };
export type SpriteRef = { sprite: Sprite };
export type SpriteProps = { texture?: Texture; tint?: number };
export type SpriteAnimationFrame = { texture?: Texture; tint?: number };
export type SpriteAnimation = {
  frames: SpriteAnimationFrame[];
  fps: number;
  loop: boolean;
  elapsed: number;
  current: number;
  playing: boolean;
};
export type SpriteAnimationProps = {
  frames: SpriteAnimationFrame[];
  fps?: number;
  loop?: boolean;
  autoplay?: boolean;
};
export type SpriteSheetProps = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
};

export const transforms = createStore<Transform>();
export const sprites = createStore<SpriteRef>();
export const spriteAnimations = createStore<SpriteAnimation>();

export const createSprite = (texture: Texture = Texture.WHITE) => new Sprite(texture);

export async function loadSpriteSheet(props: SpriteSheetProps) {
  const sheet = await Assets.load<Texture>(props.src);

  return Array.from({ length: props.frames }, (_, index) => new Texture({
    source: sheet.source,
    frame: new Rectangle(index * props.frameWidth, 0, props.frameWidth, props.frameHeight),
  }));
}

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
  animation: {
    set(entity: Entity, props: SpriteAnimationProps) {
      spriteAnimations.set(entity, {
        frames: props.frames,
        fps: props.fps ?? 8,
        loop: props.loop ?? true,
        elapsed: 0,
        current: 0,
        playing: props.autoplay ?? true,
      });
      applySpriteAnimationFrame(entity, 0);
    },
    play(entity: Entity) {
      const animation = spriteAnimations.get(entity);
      if (animation) animation.playing = true;
    },
    stop(entity: Entity) {
      const animation = spriteAnimations.get(entity);
      if (animation) animation.playing = false;
    },
  },
};

export function createSpriteAnimationSystem(animationStore: ComponentStore<SpriteAnimation> = spriteAnimations) {
  return (dt: number) => {
    for (const [entity, animation] of animationStore) {
      if (!animation.playing || animation.frames.length === 0) continue;

      animation.elapsed += dt;
      const frameDuration = 1 / animation.fps;
      if (animation.elapsed < frameDuration) continue;

      const steps = Math.floor(animation.elapsed / frameDuration);
      animation.elapsed -= steps * frameDuration;
      animation.current += steps;

      if (animation.loop) {
        animation.current %= animation.frames.length;
      } else if (animation.current >= animation.frames.length) {
        animation.current = animation.frames.length - 1;
        animation.playing = false;
      }

      applySpriteAnimationFrame(entity, animation.current);
    }
  };
}

function applySpriteAnimationFrame(entity: Entity, index: number) {
  const animation = spriteAnimations.get(entity);
  const spriteRef = sprites.get(entity);
  if (!animation || !spriteRef) return;

  const frame = animation.frames[index];
  if (!frame) return;
  if (frame.texture) spriteRef.sprite.texture = frame.texture;
  if (frame.tint !== undefined) spriteRef.sprite.tint = frame.tint;
}

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
      const scale = normalizeScale(t.scale);
      sprite.position.set(scale.x < 0 ? t.x + sprite.texture.width * Math.abs(scale.x) : t.x, t.y);
      sprite.rotation = t.rotation ?? 0;
      sprite.scale.set(scale.x, scale.y);
    }
  };
}

function normalizeScale(scale: TransformScale = 1) {
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
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

  options.world.addSystem(createSpriteAnimationSystem());
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
