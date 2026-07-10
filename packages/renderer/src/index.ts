import { Application, Assets, Container, Rectangle, Sprite, Texture, type ApplicationOptions } from "pixi.js";
import { createStore, type ComponentStore, type Entity, type World } from "@engine/ecs-core";
import { transforms, type Transform } from "@engine/components";

// Transform now lives in @engine/components (it is spatial data, not a rendering
// concern). Re-exported here so existing `@engine/renderer` importers keep working.
export { transforms, type Transform, type Vector } from "@engine/components";

export type SpriteAnchor = number | { x: number; y: number };
export type SpriteOffset = { x: number; y: number };
export type SpriteRef = {
  sprite: Sprite;
  offset: SpriteOffset;
  anchor: { x: number; y: number };
};
export type SpriteProps = {
  texture?: Texture;
  tint?: number;
  offset?: SpriteOffset;
  anchor?: SpriteAnchor;
};
export type SpriteAnimationFrame = { texture?: Texture; tint?: number };
export type SpriteAnimationClip = {
  frames: SpriteAnimationFrame[];
  fps: number;
  loop: boolean;
};
export type SpriteAnimation = {
  clips: Record<string, SpriteAnimationClip>;
  state: string;
  elapsed: number;
  current: number;
  playing: boolean;
};
export type SpriteAnimationProps = {
  clips: Record<string, SpriteAnimationClip>;
  initial: string;
  autoplay?: boolean;
};
export type SpriteSheetProps = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
};

export const sprites = createStore<SpriteRef>();
export const spriteAnimations = createStore<SpriteAnimation>();

export const createSprite = (texture: Texture = Texture.WHITE) => new Sprite(texture);

export async function loadSpriteSheet(props: SpriteSheetProps) {
  const sheet = await Assets.load<Texture>(props.src);
  sheet.source.scaleMode = "nearest";

  return Array.from({ length: props.frames }, (_, index) => new Texture({
    source: sheet.source,
    frame: new Rectangle(index * props.frameWidth, 0, props.frameWidth, props.frameHeight),
  }));
}

export function attachSprite(e: Entity, sprite = createSprite()) {
  sprites.set(e, { sprite, offset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 } });
  return sprite;
}

export const sprite = {
  set(entity: Entity, props: SpriteProps = {}) {
    const pixiSprite = createSprite(props.texture);
    if (props.tint !== undefined) pixiSprite.tint = props.tint;
    sprites.set(entity, {
      sprite: pixiSprite,
      offset: props.offset ?? { x: 0, y: 0 },
      anchor: normalizeAnchor(props.anchor),
    });
    return pixiSprite;
  },
  animation: {
    set(entity: Entity, props: SpriteAnimationProps) {
      spriteAnimations.set(entity, {
        clips: props.clips,
        state: props.initial,
        elapsed: 0,
        current: 0,
        playing: props.autoplay ?? true,
      });
      applySpriteAnimationFrame(entity, 0);
    },
    state: {
      set(entity: Entity, state: string) {
        const animation = spriteAnimations.get(entity);
        if (!animation || animation.state === state || !animation.clips[state]) return;
        animation.state = state;
        animation.elapsed = 0;
        animation.current = 0;
        applySpriteAnimationFrame(entity, 0);
      },
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
      const clip = animation.clips[animation.state];
      if (!animation.playing || !clip || clip.frames.length === 0) continue;

      animation.elapsed += dt;
      const frameDuration = 1 / clip.fps;
      if (animation.elapsed < frameDuration) continue;

      const steps = Math.floor(animation.elapsed / frameDuration);
      animation.elapsed -= steps * frameDuration;
      animation.current += steps;

      if (clip.loop) {
        animation.current %= clip.frames.length;
      } else if (animation.current >= clip.frames.length) {
        animation.current = clip.frames.length - 1;
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

  const clip = animation.clips[animation.state];
  const frame = clip?.frames[index];
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
    for (const [e, spriteRef] of spriteStore) {
      const { sprite, offset, anchor } = spriteRef;
      // Skip/purge destroyed sprites (e.g. left over from a previous world after engine.destroy()).
      if (!sprite || sprite.destroyed || !sprite.anchor) {
        spriteStore.delete(e);
        continue;
      }
      if (!sprite.parent) stage.addChild(sprite);
      const t = transformStore.get(e);
      if (!t) continue;
      sprite.anchor.set(anchor.x, anchor.y);
      sprite.position.set(
        Math.round(t.position.x + offset.x),
        Math.round(t.position.y + offset.y),
      );
      sprite.rotation = t.rotation;
      // `size` is the target size in world px (0 = auto/native). Derive the pixi
      // draw-scale from size / texture; a negative size mirrors.
      const texW = sprite.texture.width || 1;
      const texH = sprite.texture.height || 1;
      sprite.scale.set(
        t.size.x !== 0 ? t.size.x / texW : 1,
        t.size.y !== 0 ? t.size.y / texH : 1,
      );
    }
  };
}

function normalizeAnchor(anchor: SpriteAnchor = 0) {
  return typeof anchor === "number" ? { x: anchor, y: anchor } : anchor;
}

export type EngineApplicationOptions = {
  world: World;
  mount: HTMLElement;
  pixi?: Partial<ApplicationOptions>;
};

export type EngineApplication = {
  app: Application;
  tick: (dt?: number) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
  installSystems: () => void;
};

export async function createEngineApplication(options: EngineApplicationOptions): Promise<EngineApplication> {
  const app = new Application();
  await app.init(options.pixi);
  options.mount.appendChild(app.canvas);

  const installSystems = () => {
    options.world.addSystem("sprite-animation", createSpriteAnimationSystem());
    options.world.addSystem("render", createRenderSystem(app.stage));
  };
  installSystems();

  let frame = 0;
  let last = performance.now();

  function tick(dt = 0) {
    options.world.tick(dt);
  }

  function loop(now: number) {
    tick((now - last) / 1000);
    last = now;
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  tick(0);

  return {
    app,
    tick,
    installSystems,
    start() {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    },
    stop,
    destroy() {
      stop();
      app.canvas.remove();
      app.destroy(true, { children: true });
    },
  };
}
