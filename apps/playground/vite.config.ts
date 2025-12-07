import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  "@rb/tokens": path.resolve(__dirname, "../../packages/rb-tokens/src"),
  "@rb/theme": path.resolve(__dirname, "../../packages/rb-theme/src"),
  "@rb/icons": path.resolve(__dirname, "../../packages/rb-icons/src"),
  "@rb/primitives": path.resolve(__dirname, "../../packages/rb-primitives/src"),
  "@rb/windowing": path.resolve(__dirname, "../../packages/rb-windowing/src"),
  "@rb/shell": path.resolve(__dirname, "../../packages/rb-shell/src"),
  "@rb/logic-core": path.resolve(__dirname, "../../packages/rb-logic-core/src"),
  "@rb/logic-view": path.resolve(__dirname, "../../packages/rb-logic-view/src"),
  "@rb/logic-3d": path.resolve(__dirname, "../../packages/rb-logic-3d/src"),
  "@rb/apps": path.resolve(__dirname, "../../packages/rb-apps/src"),
  "@rb/utils": path.resolve(__dirname, "../../packages/rb-utils/src"),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
});
