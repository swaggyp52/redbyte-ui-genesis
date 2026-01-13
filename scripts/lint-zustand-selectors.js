import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error) return { ok: false, err: r.error.message, out: "" };
  return { ok: r.status === 0 || r.status === 1, err: "", out: (r.stdout || "") + (r.stderr || "") };
}

// Pattern: store hooks returning object literal
// This catches: useXxxStore(s => ({ ... }))
// We intentionally do NOT match comments-only lines by relying on rg's line output + later filtering.
const PATTERN = String.raw`use\w*Store\s*\(\s*\(?\s*\w+\s*=>\s*\(\s*\{`;

const rg = run("rg", [
  "-n",
  "--glob", "!**/node_modules/**",
  "--glob", "!**/dist/**",
  "--glob", "!**/build/**",
  "--glob", "!**/test-results/**",
  "--glob", "!**/playwright-report/**",
  "--glob", "!**/.next/**",
  "--glob", "!**/__tests__/**",
  PATTERN,
  "."
]);

// If ripgrep is not found, fail hard
if (rg.err.includes("not found") || rg.err.includes("command not found")) {
  const isCI = process.env.CI === "true";
  console.error("❌ FATAL: ripgrep (rg) is required but not found.");
  if (isCI) {
    console.error("In CI: ripgrep must be available. Ensure it's installed on the runner.");
    console.error("On GitHub Actions, this is pre-installed on ubuntu-latest.");
  } else {
    console.error("Local install: winget install BurntSushi.ripgrep.MSVC (Windows)");
    console.error("           or: brew install ripgrep (macOS)");
    console.error("           or: cargo install ripgrep (any OS with Rust)");
  }
  process.exit(2);
}

// If rg errored for another reason, report it
if (!rg.ok && rg.err) {
  console.error("❌ FATAL: ripgrep failed to run:", rg.err);
  process.exit(2);
}

const lines = rg.out
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean)
  // crude comment filter: ignore lines where match is after // (still not perfect, but helps)
  .filter(l => {
    const idx = l.indexOf("use");
    const c = l.indexOf("//");
    return c === -1 || idx < c;
  });

if (lines.length) {
  console.error("⚠️  Found potentially unstable Zustand object-literal selectors:\n");
  for (const l of lines) console.error("  " + l);
  console.error("\nFix: replace grouped object selectors with per-field selectors.");
  console.error("See docs/zustand-selectors.md for the pattern and Rule 1.");
  process.exit(1);
}

console.log("✓ OK: no obvious Zustand object-literal selectors found.");
process.exit(0);
