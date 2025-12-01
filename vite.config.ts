import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/", // Cloudflare requires root base path
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
