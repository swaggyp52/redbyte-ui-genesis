import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      external: [],
    }
  },
  server: {
    host: true,
    port: 5173
  }
});
