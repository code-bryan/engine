import { Application } from "@pixi/js";
import { World } from "@engine/ecs-core";
import { createKeyboardInputSys } from "@engine/input";
import { createRenderSystem } from "@engine/renderer";
import { PlayerPrefab, EnemyPrefab } from "./prefabs";

const world = new World();
PlayerPrefab(world, { x: 32, y: 64 });
EnemyPrefab(world, { x: 220, y: 64 });

const app = new Application({ width: 320, height: 180, background: 0x2c2c38 });
document.body.appendChild(app.view);

world.addSystem(createKeyboardInputSys());
world.addSystem(createRenderSystem(app.stage));

let last = performance.now();
function loop(now: number) {
  world.tick((now - last) / 1000);
  last = now; requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
