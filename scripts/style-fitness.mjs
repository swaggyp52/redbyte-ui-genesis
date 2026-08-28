#!/usr/bin/env node

/**
 * style-fitness.mjs — shrink-only Studio style fitness gate.
 *
 * Counts, per tracked CSS file under packages/ and apps/:
 *   - raw color literals (#hex, rgb()/rgba(), hsl()/hsla())
 *   - `!important` declarations
 * and compares them against a grandfathered baseline
 * (scripts/style-fitness-baseline.json).
 *
 * Contract (shrink-only):
 *   - a file may match or SHRINK its baselined counts;
 *   - any INCREASE fails;
 *   - a NEW css file starts with a budget of zero (use semantic tokens);
 *   - historical debt is frozen, never required to hit zero to ship.
 *
 * Usage:
 *   node scripts/style-fitness.mjs check    # default; exits 1 on increases
 *   node scripts/style-fitness.mjs update   # rewrite baseline from current counts
 *
 * `update` is for deliberate approvals only (e.g. after deleting a legacy
 * sheet, or consciously grandfathering a new owner). Never run it to silence
 * a failure you do not understand.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'scripts', 'style-fitness-baseline.json');

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|(?:\brgba?|\bhsla?)\(/g;
const IMPORTANT_RE = /!important/g;

function trackedCssFiles() {
  const out = execSync('git ls-files "*.css"', { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && (line.startsWith('packages/') || line.startsWith('apps/')));
}

function countFile(relPath) {
  const source = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  return {
    rawColors: (source.match(COLOR_RE) ?? []).length,
    important: (source.match(IMPORTANT_RE) ?? []).length,
  };
}

function scan() {
  const counts = {};
  for (const file of trackedCssFiles().sort()) {
    counts[file] = countFile(file);
  }
  return counts;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

const mode = process.argv[2] ?? 'check';
const current = scan();

if (mode === 'update') {
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ generated: 'shrink-only grandfathered baseline; see scripts/style-fitness.mjs', files: current }, null, 2)}\n`,
    'utf8',
  );
  console.log(`[style-fitness] baseline updated for ${Object.keys(current).length} css files.`);
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error('[style-fitness] missing scripts/style-fitness-baseline.json — run "node scripts/style-fitness.mjs update" once to grandfather current debt.');
  process.exit(1);
}

const failures = [];
const shrunk = [];
for (const [file, counts] of Object.entries(current)) {
  const base = baseline.files[file] ?? { rawColors: 0, important: 0 };
  const isNew = !(file in baseline.files);
  for (const key of ['rawColors', 'important']) {
    if (counts[key] > base[key]) {
      failures.push(
        `${file}: ${key} ${base[key]} -> ${counts[key]}${isNew ? ' (new file: budget is zero — use semantic tokens)' : ''}`,
      );
    } else if (counts[key] < base[key]) {
      shrunk.push(`${file}: ${key} ${base[key]} -> ${counts[key]}`);
    }
  }
}

if (shrunk.length > 0) {
  console.log(`[style-fitness] shrank in ${shrunk.length} place(s) — consider "update" to lock in:`);
  for (const line of shrunk) console.log(`  - ${line}`);
}

if (failures.length > 0) {
  console.error('[style-fitness] FAIL — style debt increased (shrink-only contract):');
  for (const line of failures) console.error(`  - ${line}`);
  console.error('Use semantic tokens (packages/rb-tokens, product-system-v3.css) instead of raw colors/!important, or deliberately grandfather via "update" with review.');
  process.exit(1);
}

console.log(`[style-fitness] ok — ${Object.keys(current).length} css files within shrink-only baseline.`);
