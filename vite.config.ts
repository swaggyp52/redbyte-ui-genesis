import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",        // IMPORTANT for Cloudflare + Custom Domain
  plugins: [react()],
});


