#!/usr/bin/env node
// Raw application typecheck for the workbench package (@redbyte/rb-apps).
//
// What this is: the pinned TypeScript compiler run over packages/rb-apps/tsconfig.json with no
// baseline comparison. It streams every diagnostic as tsc emits it, prints one summary line and
// exits with tsc's own exit code. It is the command behind `@redbyte/rb-apps`'s `typecheck` script
// and the root `typecheck:app`.
//
// Why it exists: until this script, `@redbyte/rb-apps` defined no `typecheck` script, so the root
// `pnpm -r --if-present run typecheck` (and the CI job that ran it) type-checked four small
// packages and skipped the application entirely. "Typecheck passed" was never a statement about
// the workbench. The ratchet in scripts/rb-typecheck-baseline.mjs bounds the count against a
// committed baseline; this script reports the count raw, with nothing subtracted.
//
// Consequence, on purpose: the root `typecheck` script now reaches rb-apps through --if-present
// and is RED while the application carries diagnostics. That is the honest state of the tree, not
// a defect in this script. Do not add a --filter exclusion to hide it. The gating signal for pull
// requests is `typecheck:baseline` (the ratchet); the CI job "Application typecheck (rb-apps, raw)"
// carries this red, with no continue-on-error, until the application type-checks clean.
//
// Guards, so that a narrowed or empty project can never look like a pass:
//   - the pinned compiler must exist (no fallback to whichever tsc happens to be hoisted);
//   - `tsc --listFilesOnly` must list at least one file under the scope's own package directory;
//   - a short list of known application entry files must appear in that listing.
// Each guard fails with a non-zero exit and a message naming exactly what is missing.
//
// When GITHUB_STEP_SUMMARY is set (GitHub Actions), a Markdown summary with the diagnostic count
// and the release-readiness statement is appended to it, on the failure paths as well.
//
//   node scripts/rb-typecheck-app.mjs        run it (exit code = tsc's exit code, or 1 on a guard)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PINNED_TYPESCRIPT, ROOT, SCOPES, parseDiagnostics, resolveTsc } from './rb-typecheck-scope.mjs';

/**
 * Files that must be in the compiled program for the check to mean anything. They are the
 * surfaces and runtime a narrowed `include` would lose first. Paths are repository-relative.
 */
const GUARD_FILES = {
  'rb-apps': [
    'packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx',
    'packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx',
    'packages/rb-apps/src/apps/ide/projectRuntime.ts',
  ],
  'rb-studio': [
    'packages/rb-studio/src/MeridianStudio.tsx',
    'packages/rb-studio/src/lenses/SourceLens.tsx',
  ],
  'rb-studio-kernel': [
    'packages/rb-studio-kernel/src/index.ts',
    'packages/rb-studio-kernel/src/timeline.ts',
  ],
};

const TAG = '[typecheck-app]';

function stepSummary(markdown) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  try {
    fs.appendFileSync(target, `${markdown}\n`);
  } catch (error) {
    console.error(`${TAG} could not append to GITHUB_STEP_SUMMARY: ${error.message}`);
  }
}

function fail(message) {
  console.error(`${TAG} FAIL: ${message}`);
  stepSummary(
    `### Application typecheck (rb-apps, raw)\n\n` +
      `**FAILED before measuring**: ${message}\n\n` +
      `No diagnostic count was produced. The candidate is **not release-ready** while this job is red.\n`
  );
  process.exit(1);
}

/** Absolute path normalised for set membership: forward slashes, case-folded on Windows only. */
function normalise(candidate) {
  const resolved = path.resolve(candidate).replace(/\\/g, '/');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function listProgramFiles(tsc, scope) {
  const result = spawnSync(process.execPath, [tsc, '-p', scope.project, '--listFilesOnly'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.error) fail(`could not run tsc --listFilesOnly for ${scope.project}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(0, 600);
    fail(`tsc --listFilesOnly exited ${result.status} for ${scope.project}${detail ? `:\n${detail}` : ''}`);
  }
  return `${result.stdout ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function guardScope(tsc, scope) {
  const listed = listProgramFiles(tsc, scope);
  const packageDir = normalise(path.join(ROOT, path.dirname(scope.project)));
  const inScope = listed.filter((file) => normalise(file).startsWith(`${packageDir}/`));
  if (listed.length === 0) fail(`${scope.project} includes zero files (tsc --listFilesOnly printed nothing).`);
  if (inScope.length === 0) {
    fail(`${scope.project} lists ${listed.length} files but none under ${path.dirname(scope.project)}/ - the project is empty or narrowed.`);
  }
  const members = new Set(listed.map(normalise));
  const missing = (GUARD_FILES[scope.name] ?? []).filter((guard) => !members.has(normalise(path.join(ROOT, guard))));
  if (missing.length > 0) {
    fail(
      `${scope.project} does not include ${missing.length} known application entry file(s): ${missing.join(', ')}. ` +
        'A narrowed or empty project can never look like a pass.'
    );
  }
  return { listed: listed.length, inScope: inScope.length };
}

function runTsc(tsc, scope) {
  const args = ['-p', scope.project, '--noEmit', '--pretty', 'false'];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsc, ...args], { cwd: ROOT });
    let captured = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        captured += chunk;
        process.stdout.write(chunk);
      });
    }
    child.on('error', (error) => resolve({ args, status: null, signal: null, error, captured }));
    child.on('close', (status, signal) => resolve({ args, status, signal, error: null, captured }));
  });
}

function topEntries(counts, n) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

const tsc = (() => {
  try {
    return resolveTsc();
  } catch (error) {
    return fail(error.message);
  }
})();
const version = spawnSync(process.execPath, [tsc, '--version'], { encoding: 'utf8' }).stdout.trim();
if (!version.includes(PINNED_TYPESCRIPT)) {
  fail(`resolved compiler reports "${version}", expected TypeScript ${PINNED_TYPESCRIPT}.`);
}

let exitCode = 0;
for (const scope of SCOPES) {
  const files = guardScope(tsc, scope);
  console.log(
    `${TAG} ${scope.name}: ${version}, ${files.listed} files in program (${files.inScope} under ${path.dirname(scope.project)}/), ` +
      `guard files present; running tsc ${['-p', scope.project, '--noEmit', '--pretty', 'false'].join(' ')}`
  );

  const result = await runTsc(tsc, scope);
  if (result.error) fail(`could not run tsc for ${scope.project}: ${result.error.message}`);
  if (result.status === null) fail(`tsc for ${scope.project} was terminated by signal ${result.signal ?? 'unknown'}.`);

  const diagnostics = parseDiagnostics(result.captured);
  const byCode = {};
  const byFile = {};
  for (const diagnostic of diagnostics) {
    byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
    byFile[diagnostic.file] = (byFile[diagnostic.file] ?? 0) + 1;
  }
  const topCodes = topEntries(byCode, 5);
  const topFiles = topEntries(byFile, 5);
  const codeSummary = topCodes.length ? topCodes.map(([code, n]) => `${code} x${n}`).join(', ') : 'none';

  // tsc exits 0 only with nothing to report and 2 with diagnostics; 1 is a configuration or crash
  // path whose message has no file prefix and so does not parse. Say which case this is rather
  // than let a zero count on a non-zero exit read as a clean run.
  let status;
  if (result.status === 0 && diagnostics.length === 0) status = 'GREEN';
  else if (result.status === 0) status = 'INCONSISTENT (tsc exit 0 but diagnostics were printed)';
  else if (diagnostics.length === 0) status = `RED (tsc exit ${result.status} without file diagnostics - read the output above)`;
  else status = `RED (tsc exit ${result.status})`;

  console.log(
    `${TAG} ${scope.name}: ${diagnostics.length} diagnostics in ${Object.keys(byFile).length} files; ` +
      `top codes ${codeSummary}; files included ${files.listed} (${files.inScope} under ${path.dirname(scope.project)}/); ` +
      `compiler ${version}; tsc exit ${result.status}; ${status}`
  );

  stepSummary(
    `### Product typecheck (${scope.name}, raw)\n\n` +
      `| | |\n|---|---|\n` +
      `| Scope | \`${scope.project}\` |\n` +
      `| Compiler | ${version} (pinned ${PINNED_TYPESCRIPT}), Node ${process.version} |\n` +
      `| Files in program | ${files.listed} (${files.inScope} under \`${path.dirname(scope.project)}/\`) |\n` +
      `| Diagnostics | **${diagnostics.length}** in ${Object.keys(byFile).length} files |\n` +
      `| tsc exit | ${result.status} |\n` +
      `| Top codes | ${codeSummary} |\n\n` +
      (topFiles.length
        ? `Top files:\n\n${topFiles.map(([file, n]) => `- \`${file}\` (${n})`).join('\n')}\n\n`
        : '') +
      (status === 'GREEN'
        ? `**Status: GREEN.** The application type-checks clean under the pinned compiler.\n`
        : `**Status: ${status}.** The candidate is **not release-ready** while this job is red. ` +
          `This job reports the raw count with nothing subtracted; the pull-request gate is the ratchet ` +
          `(\`pnpm -s typecheck:baseline\`), which only fails on an increase.\n`)
  );

  if (result.status !== 0) exitCode = Math.max(exitCode, result.status);
  else if (diagnostics.length > 0) exitCode = Math.max(exitCode, 1);
}

process.exit(exitCode);
