import { Container, Sprite, Texture } from "@pixi/js";
import { createStore, type ComponentStore, type Entity } from "@engine/ecs-core";

export type Transform = { x: number; y: number; rotation?: number; scale?: number };
export type SpriteRef = { sprite: Sprite };

export const transforms = createStore<Transform>();
export const sprites = createStore<SpriteRef>();

export const createSprite = (texture: Texture = Texture.WHITE) => new Sprite(texture);

export function attachSprite(e: Entity, sprite = createSprite()) {
  sprites.set(e, { sprite });
  return sprite;
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
      sprite.position.set(t.x, t.y);
      sprite.rotation = t.rotation ?? 0;
      sprite.scale.set(t.scale ?? 1);
    }
  };
}
