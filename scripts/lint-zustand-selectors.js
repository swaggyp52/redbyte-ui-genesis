import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["apps", "packages", "src"];
const EXT = new Set([".ts", ".tsx"]);

const offenders = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (
        ent.name === "node_modules" ||
        ent.name === "dist" ||
        ent.name === "build" ||
        ent.name === "playwright-report" ||
        ent.name === "test-results" ||
        ent.name === ".next" ||
        ent.name === ".vite" ||
        ent.name === "__tests__"
      )
        return;
      walk(p);
    } else if (ent.isFile() && EXT.has(path.extname(ent.name))) {
      // Skip test files and non-existent references
      if (ent.name.endsWith(".test.tsx") || ent.name.endsWith(".test.ts"))
        return;

      if (!fs.existsSync(p)) return;

      const txt = fs.readFileSync(p, "utf8");

      // More precise pattern: useXxxStore directly followed by object literal
      // Match: useXxxStore((state) => ({ or useStore(s => ({
      // But exclude lines starting with // or * (comments)
      const lines = txt.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment lines
        if (line.trim().startsWith("//") || line.trim().startsWith("*"))
          continue;
        // Look for the pattern: use*Store followed by selector opening with {
        if (
          line.includes("use") &&
          line.match(/use\w*Store\(\s*[\w()]*\s*=>\s*\{/)
        ) {
          // Double-check it's not a code comment by checking context
          if (!line.includes("//") && !line.includes("/*")) {
            offenders.push({ file: p, line: i + 1, text: line.trim() });
            break;
          }
        }
      }
    }
  }
}

for (const d of TARGET_DIRS) {
  walk(path.join(ROOT, d));
}

if (offenders.length) {
  console.error(
    "⚠️  Found possible unstable Zustand object-literal selectors in React components:\n"
  );
  for (const off of offenders) {
    console.error(
      `   ${path.relative(ROOT, off.file)}:${off.line}`
    );
    console.error(`      ${off.text.substring(0, 80)}\n`);
  }
  console.error(
    "See docs/zustand-selectors.md for why this pattern causes React #185."
  );
  console.error(
    "Replace with individual per-field selectors like: const a = useStore(s => s.a)"
  );
  process.exit(1);
} else {
  console.log("✓ No obvious Zustand object-literal selectors found.");
  process.exit(0);
}
