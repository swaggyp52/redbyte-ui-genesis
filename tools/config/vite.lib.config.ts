import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import fs from "node:fs";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
);

// Turn "@rb/rb-tokens" -> "rb-tokens"
const pkgName = pkg.name || "rb-lib";
const baseName = pkgName.includes("/") ? pkgName.split("/")[1] : pkgName;
const externals = ["react", "react-dom", "react/jsx-runtime", ...Object.keys(pkg.dependencies || {})];

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    lib: {
      entry: path.resolve(process.cwd(), "src/index.ts"),
      name: baseName,
      fileName: baseName,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // keep externals small & safe
      external: externals,
    },
  },
});
