// ../../tools/config/vite.lib.config.ts
import { defineConfig } from "file:///C:/Users/conno/redbyte-ui/node_modules/.pnpm/vite@7.2.6_@types+node@24.10.1_jiti@1.21.7_tsx@4.21.0/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///C:/Users/conno/redbyte-ui/node_modules/.pnpm/vite-tsconfig-paths@5.1.4_t_46f413e220403a443df4ba440bac11cd/node_modules/vite-tsconfig-paths/dist/index.js";
import dts from "file:///C:/Users/conno/redbyte-ui/node_modules/.pnpm/vite-plugin-dts@4.5.4_@type_8d7ff754e48bc93f3d197de9c3fb490a/node_modules/vite-plugin-dts/dist/index.mjs";
import path from "node:path";
import fs from "node:fs";
var pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
);
var pkgName = pkg.name || "rb-lib";
var baseName = pkgName.includes("/") ? pkgName.split("/")[1] : pkgName;
var vite_lib_config_default = defineConfig({
  plugins: [
    tsconfigPaths(),
    dts({
      insertTypesEntry: true,
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"]
    })
  ],
  build: {
    lib: {
      entry: path.resolve(process.cwd(), "src/index.ts"),
      name: baseName,
      fileName: baseName,
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      // keep externals small & safe
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        /^@redbyte\//
        // externalize all internal packages
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime"
        }
      }
    }
  }
});

// vite.config.ts
var vite_config_default = vite_lib_config_default;
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdG9vbHMvY29uZmlnL3ZpdGUubGliLmNvbmZpZy50cyIsICJ2aXRlLmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGNvbm5vXFxcXHJlZGJ5dGUtdWlcXFxcdG9vbHNcXFxcY29uZmlnXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjb25ub1xcXFxyZWRieXRlLXVpXFxcXHRvb2xzXFxcXGNvbmZpZ1xcXFx2aXRlLmxpYi5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2Nvbm5vL3JlZGJ5dGUtdWkvdG9vbHMvY29uZmlnL3ZpdGUubGliLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuaW1wb3J0IGR0cyBmcm9tIFwidml0ZS1wbHVnaW4tZHRzXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgZnMgZnJvbSBcIm5vZGU6ZnNcIjtcblxuY29uc3QgcGtnID0gSlNPTi5wYXJzZShcbiAgZnMucmVhZEZpbGVTeW5jKHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInBhY2thZ2UuanNvblwiKSwgXCJ1dGYtOFwiKVxuKTtcblxuLy8gVHVybiBcIkByZWRieXRlL3JiLXRva2Vuc1wiIC0+IFwicmItdG9rZW5zXCJcbmNvbnN0IHBrZ05hbWUgPSBwa2cubmFtZSB8fCBcInJiLWxpYlwiO1xuY29uc3QgYmFzZU5hbWUgPSBwa2dOYW1lLmluY2x1ZGVzKFwiL1wiKSA/IHBrZ05hbWUuc3BsaXQoXCIvXCIpWzFdIDogcGtnTmFtZTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHRzY29uZmlnUGF0aHMoKSxcbiAgICBkdHMoe1xuICAgICAgaW5zZXJ0VHlwZXNFbnRyeTogdHJ1ZSxcbiAgICAgIGV4Y2x1ZGU6IFtcIioqL19fdGVzdHNfXy8qKlwiLCBcIioqLyoudGVzdC50c1wiLCBcIioqLyoudGVzdC50c3hcIiwgXCIqKi8qLnNwZWMudHNcIiwgXCIqKi8qLnNwZWMudHN4XCJdLFxuICAgIH0pLFxuICBdLFxuICBidWlsZDoge1xuICAgIGxpYjoge1xuICAgICAgZW50cnk6IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInNyYy9pbmRleC50c1wiKSxcbiAgICAgIG5hbWU6IGJhc2VOYW1lLFxuICAgICAgZmlsZU5hbWU6IGJhc2VOYW1lLFxuICAgICAgZm9ybWF0czogW1wiZXNcIiwgXCJjanNcIl0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAvLyBrZWVwIGV4dGVybmFscyBzbWFsbCAmIHNhZmVcbiAgICAgIGV4dGVybmFsOiBbXG4gICAgICAgIFwicmVhY3RcIixcbiAgICAgICAgXCJyZWFjdC1kb21cIixcbiAgICAgICAgXCJyZWFjdC9qc3gtcnVudGltZVwiLFxuICAgICAgICAvXkByZWRieXRlXFwvLywgIC8vIGV4dGVybmFsaXplIGFsbCBpbnRlcm5hbCBwYWNrYWdlc1xuICAgICAgXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgcmVhY3Q6IFwiUmVhY3RcIixcbiAgICAgICAgICBcInJlYWN0LWRvbVwiOiBcIlJlYWN0RE9NXCIsXG4gICAgICAgICAgXCJyZWFjdC9qc3gtcnVudGltZVwiOiBcImpzeFJ1bnRpbWVcIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjb25ub1xcXFxyZWRieXRlLXVpXFxcXHBhY2thZ2VzXFxcXHJiLWFwcHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGNvbm5vXFxcXHJlZGJ5dGUtdWlcXFxccGFja2FnZXNcXFxccmItYXBwc1xcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvY29ubm8vcmVkYnl0ZS11aS9wYWNrYWdlcy9yYi1hcHBzL3ZpdGUuY29uZmlnLnRzXCI7Ly8gQ29weXJpZ2h0IFx1MDBBOSAyMDI1IENvbm5vciBBbmdpZWwgXHUyMDE0IFJlZEJ5dGUgT1MgR2VuZXNpc1xyXG4vLyBVc2Ugd2l0aG91dCBwZXJtaXNzaW9uIHByb2hpYml0ZWQuXHJcbi8vIExpY2Vuc2VkIHVuZGVyIHRoZSBSZWRCeXRlIFByb3ByaWV0YXJ5IExpY2Vuc2UgKFJQTC0xLjApLiBTZWUgTElDRU5TRS5cclxuXHJcbmltcG9ydCBiYXNlIGZyb20gJy4uLy4uL3Rvb2xzL2NvbmZpZy92aXRlLmxpYi5jb25maWcnO1xyXG5leHBvcnQgZGVmYXVsdCBiYXNlO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdULFNBQVMsb0JBQW9CO0FBQ3JWLE9BQU8sbUJBQW1CO0FBQzFCLE9BQU8sU0FBUztBQUNoQixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBRWYsSUFBTSxNQUFNLEtBQUs7QUFBQSxFQUNmLEdBQUcsYUFBYSxLQUFLLFFBQVEsUUFBUSxJQUFJLEdBQUcsY0FBYyxHQUFHLE9BQU87QUFDdEU7QUFHQSxJQUFNLFVBQVUsSUFBSSxRQUFRO0FBQzVCLElBQU0sV0FBVyxRQUFRLFNBQVMsR0FBRyxJQUFJLFFBQVEsTUFBTSxHQUFHLEVBQUUsQ0FBQyxJQUFJO0FBRWpFLElBQU8sMEJBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLGNBQWM7QUFBQSxJQUNkLElBQUk7QUFBQSxNQUNGLGtCQUFrQjtBQUFBLE1BQ2xCLFNBQVMsQ0FBQyxtQkFBbUIsZ0JBQWdCLGlCQUFpQixnQkFBZ0IsZUFBZTtBQUFBLElBQy9GLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxLQUFLO0FBQUEsTUFDSCxPQUFPLEtBQUssUUFBUSxRQUFRLElBQUksR0FBRyxjQUFjO0FBQUEsTUFDakQsTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BQ1YsU0FBUyxDQUFDLE1BQU0sS0FBSztBQUFBLElBQ3ZCO0FBQUEsSUFDQSxlQUFlO0FBQUE7QUFBQSxNQUViLFVBQVU7QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUE7QUFBQSxNQUNGO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixTQUFTO0FBQUEsVUFDUCxPQUFPO0FBQUEsVUFDUCxhQUFhO0FBQUEsVUFDYixxQkFBcUI7QUFBQSxRQUN2QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7OztBQ3pDRCxJQUFPLHNCQUFROyIsCiAgIm5hbWVzIjogW10KfQo=
