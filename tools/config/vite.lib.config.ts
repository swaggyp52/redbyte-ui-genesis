import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import path from "node:path";
import fs from "node:fs";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
);

// Turn "@redbyte/rb-tokens" -> "rb-tokens"
const pkgName = pkg.name || "rb-lib";
const baseName = pkgName.includes("/") ? pkgName.split("/")[1] : pkgName;

export default defineConfig({
  // The .ts/.tsx modules are the source of truth and the tracked .js siblings beside them are
  // mirrors, some stale; Vite's default order tries .js first. Library dists are built from the
  // same modules the tests verify.
  resolve: {
    extensions: [".ts", ".tsx", ".mts", ".cts", ".mjs", ".js", ".jsx", ".cjs", ".json"],
  },
  plugins: [
    tsconfigPaths(),
    dts({
      insertTypesEntry: true,
      skipDiagnostics: true,
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(process.cwd(), "src/index.ts"),
      name: baseName,
      fileName: baseName,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // keep externals small & safe
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        /^@redbyte\//,  // externalize all internal packages
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
  },
});
