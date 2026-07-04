import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@engine/ecs-core": resolve(__dirname, "../../packages/ecs-core/src/index.ts"),
      "@engine/renderer": resolve(__dirname, "../../packages/renderer/src/index.ts"),
      "@engine/loader": resolve(__dirname, "../../packages/loader/src/index.ts"),
      "@engine/input": resolve(__dirname, "../../packages/input/src/index.ts"),
    },
  },
});
