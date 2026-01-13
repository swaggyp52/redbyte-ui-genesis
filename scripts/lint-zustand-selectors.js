import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error) return { ok: false, err: r.error.message, out: "" };
  return { ok: r.status === 0 || r.status === 1, err: "", out: (r.stdout || "") + (r.stderr || "") };
}

// Pattern: store hooks returning object/array literals (fresh reference each time)
// Catches: object literals, array literals, spread operators
const PATTERN1 = String.raw`use\w*Store\s*\(\s*\(?\s*\w+\s*=>\s*\(\s*\{`;
const PATTERN2 = String.raw`use\w*Store\s*\(\s*\(?\s*\w+\s*=>\s*\{\s*(?:\/\/|\/\*)?[^}]*\breturn\s*\{`;
const PATTERN3 = String.raw`use\w*Store\s*\(\s*\(?\s*\w+\s*=>\s*\[`;
const PATTERN4 = String.raw`use\w*Store\s*\(\s*\(?\s*\w+\s*=>\s*\{\s*(?:\/\/|\/\*)?[^}]*\breturn\s*\[`;
const PATTERN5 = String.raw`use\w*Store\s*\(\s*\(?\s*\w+\s*=>\s*\(\s*\{\\s*\.\.\.`;

const globs = [
  "-n",
  "--glob", "**/*.{ts,tsx,js,jsx}",
  "--glob", "!**/node_modules/**",
  "--glob", "!**/dist/**",
  "--glob", "!**/build/**",
  "--glob", "!**/test-results/**",
  "--glob", "!**/playwright-report/**",
  "--glob", "!**/.next/**",
  "--glob", "!**/__tests__/**",
  "--glob", "!**/*.test.{ts,tsx,js,jsx}",
  "--glob", "!**/*.spec.{ts,tsx,js,jsx}",
];

// Run all patterns and merge results
const rg1 = run("rg", [...globs, PATTERN1, "."]);
const rg2 = run("rg", [...globs, PATTERN2, "."]);
const rg3 = run("rg", [...globs, PATTERN3, "."]);
const rg4 = run("rg", [...globs, PATTERN4, "."]);
const rg5 = run("rg", [...globs, PATTERN5, "."]);
const rg = {
  ok: rg1.ok && rg2.ok && rg3.ok && rg4.ok && rg5.ok,
  err: rg1.err || rg2.err || rg3.err || rg4.err || rg5.err,
  out: [rg1.out, rg2.out, rg3.out, rg4.out, rg5.out]
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n"),
};
// If ripgrep is not found, fail hard with clear platform-specific guidance
if (rg.err.includes("not found") || rg.err.includes("command not found")) {
  const isCI = process.env.CI === "true";
  console.error("❌ FATAL: ripgrep (rg) is required but not found.");
  console.error("");
  if (isCI) {
    console.error("🔧 CI Fix (GitHub Actions):");
    console.error("   This should be installed by the 'Install ripgrep' workflow step.");
    console.error("   If running on a custom runner, ensure ripgrep is installed.");
    console.error("");
  }
  console.error("🔧 Local Install Options:");
  console.error("   Windows:   winget install BurntSushi.ripgrep.MSVC");
  console.error("             or: choco install ripgrep");
  console.error("             or: scoop install ripgrep");
  console.error("   macOS:     brew install ripgrep");
  console.error("   Linux:     sudo apt-get install -y ripgrep (Ubuntu/Debian)");
  console.error("             or: dnf install ripgrep (Fedora)");
  console.error("             or: pacman -S ripgrep (Arch)");
  console.error("   Any OS:    cargo install ripgrep (requires Rust)");
  console.error("");
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
