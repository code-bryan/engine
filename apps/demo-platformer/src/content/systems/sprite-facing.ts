import { transforms, type TransformScale } from "@engine/renderer";
import { getComponentStore } from "@engine/runtime";

export function createSpriteFacingSystem() {
  const facings = getComponentStore<"left" | "right">("facing");
  const velocities = getComponentStore<{ x: number; y: number }>("velocity");
  return () => {
    for (const [entity, velocity] of velocities) {
      if (velocity.x === 0) continue;

      const facing = velocity.x < 0 ? "left" : "right";
      facings.set(entity, facing);

      const transform = transforms.get(entity);
      if (!transform) continue;

      const baseScale = getBaseScale(transform.scale);
      transform.scale = {
        x: facing === "left" ? -baseScale : baseScale,
        y: baseScale,
      };
    }
  };
}

function getBaseScale(scale: TransformScale = 1) {
  if (typeof scale === "number") return Math.abs(scale);
  return Math.abs(scale.y);
}
