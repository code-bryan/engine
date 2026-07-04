import { transforms, type TransformScale } from "@engine/renderer";
import { facings, velocities } from "../components";

export function createSpriteFacingSystem() {
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
