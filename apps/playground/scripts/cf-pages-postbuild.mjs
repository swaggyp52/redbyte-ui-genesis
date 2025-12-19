import fs from "node:fs";
import path from "node:path";

const dist = path.join(process.cwd(), "dist");
const indexHtml = path.join(dist, "index.html");

// Extensionless SPA entry (avoids CF pretty-url stripping .html and looping)
const spaPath = path.join(dist, "__spa");

// These MUST be in the build output root for Cloudflare Pages
const redirectsPath = path.join(dist, "_redirects");
const headersPath   = path.join(dist, "_headers");

if (!fs.existsSync(indexHtml)) {
  console.error(`[cf-pages-postbuild] Missing ${indexHtml}. Did the build run?`);
  process.exit(1);
}

// 1) Create extensionless fallback file
fs.copyFileSync(indexHtml, spaPath);

// 2) Bypass assets (and common static types) so they do NOT get rewritten to SPA HTML
//    Then: rewrite everything else to /__spa (served as HTML via _headers)
const redirects = [
  "/assets/* /assets/:splat 200",
  "/*.js /:splat 200",
  "/*.css /:splat 200",
  "/*.map /:splat 200",
  "/*.svg /:splat 200",
  "/*.png /:splat 200",
  "/*.jpg /:splat 200",
  "/*.jpeg /:splat 200",
  "/*.ico /:splat 200",
  "/*.json /:splat 200",
  "/*.txt /:splat 200",
  "/*.woff2 /:splat 200",
  "/*.woff /:splat 200",
  "/*.ttf /:splat 200",
  "/*.eot /:splat 200",
  "/* /__spa 200",
].join("\n") + "\n";

fs.writeFileSync(redirectsPath, redirects, "utf8");

// 3) Force SPA fallback to be served as HTML (prevents “download file” behavior)
const headers = [
  "/__spa",
  "  Content-Type: text/html; charset=utf-8",
  "",
].join("\n");

fs.writeFileSync(headersPath, headers, "utf8");

console.log(`[cf-pages-postbuild] Wrote ${spaPath}`);
console.log(`[cf-pages-postbuild] Wrote ${redirectsPath}`);
console.log(`[cf-pages-postbuild] Wrote ${headersPath}`);