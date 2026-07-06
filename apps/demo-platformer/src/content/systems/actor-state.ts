import { sprite } from "@engine/renderer";
import { actorStates, players, velocities } from "../components";

export function createActorStateSystem() {
  return () => {
    for (const entity of players.keys()) {
      const velocity = velocities.get(entity);
      if (!velocity) continue;

      const nextState = velocity.x === 0 && velocity.y === 0 ? "idle" : "walk";
      const currentState = actorStates.get(entity);
      if (currentState === nextState) continue;

      actorStates.set(entity, nextState);
      sprite.animation.state.set(entity, nextState);
    }
  };
}
