// Shared TypeScript scope and compiler resolution for the repository's type checks.
//
// Two consumers read this module and must agree on every value in it:
//   scripts/rb-typecheck-baseline.mjs  the ratchet: compares a count and fingerprint against
//                                      docs/validation/typecheck-baseline.json and fails on an increase
//   scripts/rb-typecheck-app.mjs       the raw check: streams the diagnostics, prints a summary and
//                                      exits with the compiler's own exit code
// A count is only meaningful beside the project and the compiler that produced it, so the scope
// list, the pinned compiler and the diagnostic parser live here and nowhere else. Change them here
// and both commands change together; change them in one consumer and the two stop measuring the
// same thing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root (this file lives in `scripts/`). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Product scopes that must type-check clean. `typecheck:app` runs each one raw and exits non-zero
 * on any diagnostic. Add a scope, do not widen one.
 */
export const SCOPES = [
  { name: 'rb-apps', project: 'packages/rb-apps/tsconfig.json' },
  { name: 'rb-studio', project: 'packages/rb-studio/tsconfig.json' },
  { name: 'rb-studio-kernel', project: 'packages/rb-studio-kernel/tsconfig.json' },
];

/**
 * Scopes the ratchet records and compares. Beyond the product scopes it records the whole-repo
 * program (the root tsconfig includes every package and app), so type debt outside the product
 * scopes stays visible and cannot grow: on 2026-10-26 it held 141 diagnostics, mostly
 * rb-logic-core and rb-logic-view test and legacy determinism code. This is also the program a
 * package without its own tsconfig falls back to during declaration emit.
 */
export const BASELINE_SCOPES = [
  ...SCOPES,
  { name: 'repo', project: 'tsconfig.json' },
];

// `@redbyte/rb-apps` declares no TypeScript of its own, and three versions are installed through
// other packages (5.3.3, 5.8.2, 5.9.3). Whichever one a bare `tsc` happens to resolve changes the
// count — 5.3.3 reports 762 diagnostics where 5.9.3 reports 778 — so a number is only meaningful
// beside the compiler that produced it. This pins one; the ratchet refuses to compare across a change.
export const PINNED_TYPESCRIPT = '5.9.3';

/** The pinned compiler, resolved through the store rather than a hoisted or global tsc. */
export function resolveTsc() {
  const pinned = path.join(
    ROOT, 'node_modules', '.pnpm', `typescript@${PINNED_TYPESCRIPT}`, 'node_modules', 'typescript', 'bin', 'tsc'
  );
  if (fs.existsSync(pinned)) return pinned;
  throw new Error(
    `TypeScript ${PINNED_TYPESCRIPT} is not installed at ${pinned}. ` +
      'Install it, or change PINNED_TYPESCRIPT and re-record the baseline with --write.'
  );
}

/** One `tsc --pretty false` diagnostic line: `file(line,col): error TSnnnn: message`. */
export const DIAGNOSTIC = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/**
 * Parses `tsc --pretty false` output into one record per diagnostic line. Continuation lines
 * (the indented "Type 'x' is not assignable..." elaboration) carry no file prefix and are dropped,
 * so the count is the number of diagnostics, not the number of output lines. File paths are
 * normalised to forward slashes so a Windows and a Linux run fingerprint the same way.
 */
export function parseDiagnostics(output) {
  const diagnostics = [];
  for (const line of `${output ?? ''}`.split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(line.trim());
    if (!match) continue;
    diagnostics.push({
      file: match[1].replace(/\\/g, '/'),
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4],
      message: match[5],
    });
  }
  return diagnostics;
}
