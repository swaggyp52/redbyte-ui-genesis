#!/usr/bin/env node
// Records and compares the TypeScript diagnostic baseline for a named compiler scope.
//
// Why this exists: the root `typecheck` script is `pnpm -r --if-present run typecheck`, and
// `@redbyte/rb-apps` — the package that holds the workbench — does not define one. So the root
// command, and the CI job that runs it, type-check four small packages and silently skip the
// product. "Typecheck passed" was therefore not a statement about rb-apps at all, and
// "778 unchanged" was a number from a command nothing in the repository encoded.
//
// This script encodes the scope, records the fingerprint, and fails on an INCREASE. It does not
// hide the existing diagnostics, suppress them, or loosen any compiler setting: the baseline is
// committed in full so the count, the shape and the owning files are all reviewable.
//
//   node scripts/rb-typecheck-baseline.mjs            compare against the committed baseline
//   node scripts/rb-typecheck-baseline.mjs --write    re-record it (say why in the commit)
//   node scripts/rb-typecheck-baseline.mjs --json     print the fingerprint and exit 0
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'docs', 'validation', 'typecheck-baseline.json');

/** Every scope this repository claims to have type-checked. Add a scope, do not widen one. */
const SCOPES = [
  { name: 'rb-apps', project: 'packages/rb-apps/tsconfig.json' },
];

// `@redbyte/rb-apps` declares no TypeScript of its own, and three versions are installed through
// other packages (5.3.3, 5.8.2, 5.9.3). Whichever one a bare `tsc` happens to resolve changes the
// count — 5.3.3 reports 762 diagnostics where 5.9.3 reports 778 — so a number is only meaningful
// beside the compiler that produced it. This pins one and refuses to compare across a change.
const PINNED_TYPESCRIPT = '5.9.3';

/** The pinned compiler, resolved through the store rather than a hoisted or global tsc. */
function resolveTsc() {
  const pinned = path.join(
    ROOT, 'node_modules', '.pnpm', `typescript@${PINNED_TYPESCRIPT}`, 'node_modules', 'typescript', 'bin', 'tsc'
  );
  if (fs.existsSync(pinned)) return pinned;
  throw new Error(
    `TypeScript ${PINNED_TYPESCRIPT} is not installed at ${pinned}. ` +
      'Install it, or change PINNED_TYPESCRIPT and re-record the baseline with --write.'
  );
}

const DIAGNOSTIC = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function run(scope, tsc) {
  const args = ['-p', scope.project, '--noEmit', '--pretty', 'false'];
  const result = spawnSync(process.execPath, [tsc, ...args], { cwd: ROOT, encoding: 'utf8' });
  const lines = `${result.stdout ?? ''}${result.stderr ?? ''}`.split(/\r?\n/);
  const diagnostics = [];
  for (const line of lines) {
    const match = DIAGNOSTIC.exec(line.trim());
    if (match) diagnostics.push({ file: match[1].replace(/\\/g, '/'), code: match[4] });
  }
  const byCode = {};
  const byFile = {};
  for (const diagnostic of diagnostics) {
    byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
    byFile[diagnostic.file] = (byFile[diagnostic.file] ?? 0) + 1;
  }
  // The fingerprint is file+code without line numbers: it survives an edit that moves a line,
  // and changes the moment a new kind of error appears or one moves to another file.
  const fingerprint = createHash('sha256')
    .update(diagnostics.map((d) => `${d.file}|${d.code}`).sort().join('\n'))
    .digest('hex')
    .slice(0, 16);
  return {
    scope: scope.name,
    command: `tsc ${args.join(' ')}`,
    project: scope.project,
    exitCode: result.status,
    total: diagnostics.length,
    fingerprint,
    byCode: Object.fromEntries(Object.entries(byCode).sort((a, b) => b[1] - a[1])),
    // Every file, not a top-N slice: a truncated list cannot attribute a regression to the file
    // that caused it, which is the only question this record exists to answer.
    byFile: Object.fromEntries(Object.entries(byFile).sort((a, b) => b[1] - a[1])),
  };
}

const tsc = resolveTsc();
const version = spawnSync(process.execPath, [tsc, '--version'], { encoding: 'utf8' }).stdout.trim();
const measured = { compiler: version, node: process.version, scopes: SCOPES.map((scope) => run(scope, tsc)) };

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(measured, null, 2));
  process.exit(0);
}

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, `${JSON.stringify(measured, null, 2)}\n`);
  console.log(`[typecheck-baseline] recorded ${BASELINE}`);
  for (const scope of measured.scopes) {
    console.log(`  ${scope.scope}: ${scope.total} diagnostics, exit ${scope.exitCode}, fingerprint ${scope.fingerprint}`);
  }
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error(`[typecheck-baseline] no baseline at ${BASELINE}; run with --write`);
  process.exit(1);
}
const recorded = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
let failed = false;
for (const scope of measured.scopes) {
  const before = recorded.scopes.find((entry) => entry.scope === scope.scope);
  if (!before) {
    console.error(`[typecheck-baseline] ${scope.scope}: no recorded baseline for this scope`);
    failed = true;
    continue;
  }
  const delta = scope.total - before.total;
  const shape = scope.fingerprint === before.fingerprint ? 'identical' : 'changed';
  console.log(
    `[typecheck-baseline] ${scope.scope}: ${scope.total} diagnostics (${delta >= 0 ? '+' : ''}${delta}), shape ${shape}, exit ${scope.exitCode}`
  );
  if (delta > 0) {
    failed = true;
    const news = Object.entries(scope.byFile).filter(([file, count]) => (before.byFile[file] ?? 0) < count);
    for (const [file, count] of news.slice(0, 10)) {
      console.error(`  worse: ${file} ${before.byFile[file] ?? 0} -> ${count}`);
    }
  }
  if (delta < 0) console.log('  fewer diagnostics than the baseline; re-record with --write and say why.');
}
if (recorded.compiler !== measured.compiler) {
  // A count from a different compiler is a different measurement, not a regression or a win.
  console.error(`[typecheck-baseline] compiler changed: ${recorded.compiler} -> ${measured.compiler}`);
  console.error('  counts are not comparable across compiler versions; re-record with --write.');
  failed = true;
}
process.exit(failed ? 1 : 0);
