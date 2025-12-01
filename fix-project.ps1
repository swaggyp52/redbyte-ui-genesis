Write-Host '=== FIXING PROJECT ===' -ForegroundColor Yellow

Set-Content vite.config.ts @'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "",
  plugins: [react()],
});
'@

Set-Content src/main.tsx @'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
'@

npm install

Write-Host '=== FIX COMPLETE ===' -ForegroundColor Green
