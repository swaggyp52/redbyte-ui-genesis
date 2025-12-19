import fs from "node:fs";
import path from "node:path";

const dist = path.join(process.cwd(), "dist");
const src = path.join(dist, "index.html");
const dst = path.join(dist, "__spa-fallback.htm");

if (!fs.existsSync(src)) {
  console.error(`[cf-spa-fallback] Missing ${src}. Did the build run?`);
  process.exit(1);
}

fs.copyFileSync(src, dst);
console.log(`[cf-spa-fallback] Wrote ${dst}`);