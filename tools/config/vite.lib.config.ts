import { defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
);

// Turn "@rb/rb-tokens" -> "rb-tokens"
const pkgName = pkg.name || "rb-lib";
const baseName = pkgName.includes("/") ? pkgName.split("/")[1] : pkgName;

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(process.cwd(), "src/index.ts"),
      name: baseName,
      fileName: baseName,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // keep externals small & safe
      external: ["react", "react-dom"],
    },
  },
});
