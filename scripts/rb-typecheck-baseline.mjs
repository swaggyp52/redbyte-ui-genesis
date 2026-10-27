#!/usr/bin/env node
// Records and compares the TypeScript diagnostic baseline for a named compiler scope.
//
// Why this exists: the root `typecheck` script is `pnpm -r --if-present run typecheck`, and
// `@redbyte/rb-apps` — the package that holds the workbench — does not define one. So the root
// command, and the CI job that runs it, type-check four small packages and silently skip the
// product. "Typecheck passed" was therefore not a statement about rb-apps at all, and
// "778 unchanged" was a number from a command nothing in the repository encoded.
//
// This script encodes the scope, records the fingerprint, and fails on ANY CHANGE: an increase, a
// new file+code pair at an equal count (a diagnostic moved or a new kind appeared), and a decrease
// that has not been re-recorded. The last one matters: a baseline left at 778 after rb-apps reached
// 0 let up to 778 new diagnostics in unnoticed (found 2026-10-26). An improvement is locked in only
// by re-recording it. It does not hide the existing diagnostics, suppress them, or loosen any
// compiler setting: the baseline is committed in full so the count, the shape and the owning files
// are all reviewable.
//
//   node scripts/rb-typecheck-baseline.mjs            compare against the committed baseline
//   node scripts/rb-typecheck-baseline.mjs --write    re-record it (say why in the commit)
//   node scripts/rb-typecheck-baseline.mjs --json     print the fingerprint and exit 0
//
// The scope list, the pinned compiler (5.9.3 - three versions are installed and 5.3.3 reports a
// different count) and the diagnostic parser are shared with scripts/rb-typecheck-app.mjs, the raw
// application check, through scripts/rb-typecheck-scope.mjs so that both commands measure the same
// project with the same compiler. This script's comparison, output and exit semantics are its own.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BASELINE_SCOPES, ROOT, parseDiagnostics, resolveTsc } from './rb-typecheck-scope.mjs';

const BASELINE = path.join(ROOT, 'docs', 'validation', 'typecheck-baseline.json');

function run(scope, tsc) {
  const args = ['-p', scope.project, '--noEmit', '--pretty', 'false'];
  const result = spawnSync(process.execPath, [tsc, ...args], { cwd: ROOT, encoding: 'utf8' });
  const diagnostics = parseDiagnostics(`${result.stdout ?? ''}${result.stderr ?? ''}`);
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
const measured = { compiler: version, node: process.version, scopes: BASELINE_SCOPES.map((scope) => run(scope, tsc)) };

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
  const worse = Object.entries(scope.byFile).filter(([file, count]) => (before.byFile[file] ?? 0) < count);
  if (delta > 0 || worse.length > 0) {
    // More diagnostics, or a file that now has more than it did (a new diagnostic hidden behind
    // a fix elsewhere at the same total): both are regressions.
    failed = true;
    for (const [file, count] of worse.slice(0, 10)) {
      console.error(`  worse: ${file} ${before.byFile[file] ?? 0} -> ${count}`);
    }
  } else if (shape === 'changed' || delta < 0) {
    // Only improvements, but the committed baseline no longer describes the tree. Left alone it
    // would let new diagnostics back in up to the old count, so this fails until re-recorded.
    failed = true;
    console.error('  the baseline is stale (fewer or different diagnostics); re-record with --write and say why in the commit.');
  }
}
const measuredNames = new Set(measured.scopes.map((scope) => scope.scope));
for (const entry of recorded.scopes) {
  if (!measuredNames.has(entry.scope)) {
    console.error(`[typecheck-baseline] ${entry.scope}: recorded but no longer measured; a scope may not be dropped silently.`);
    failed = true;
  }
}
if (recorded.compiler !== measured.compiler) {
  // A count from a different compiler is a different measurement, not a regression or a win.
  console.error(`[typecheck-baseline] compiler changed: ${recorded.compiler} -> ${measured.compiler}`);
  console.error('  counts are not comparable across compiler versions; re-record with --write.');
  failed = true;
}
process.exit(failed ? 1 : 0);
