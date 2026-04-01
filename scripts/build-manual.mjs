#!/usr/bin/env node
/**
 * build-manual.mjs
 *
 * Generates RedByte_Product_Manual.pdf from the HTML companion.
 *
 * Usage:
 *   pnpm docs:manual          # full build (validate + generate PDF)
 *   pnpm docs:manual:pdf      # PDF-only, skip validation
 *
 * Requirements:
 *   pip install weasyprint --break-system-packages
 *
 * The script:
 *   1. Verifies source files exist.
 *   2. Checks for known stale strings (catches regressions like "constraints.xdc", "top_tb").
 *   3. Invokes weasyprint to regenerate the PDF.
 *   4. Reports output file size.
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANUALS_DIR = resolve(ROOT, 'docs/manuals');

const HTML_SRC  = resolve(MANUALS_DIR, 'RedByte_Product_Manual_print.html');
const MD_SRC    = resolve(MANUALS_DIR, 'RedByte_Product_Manual.md');
const PDF_OUT   = resolve(MANUALS_DIR, 'RedByte_Product_Manual.pdf');

const PDF_ONLY  = process.argv.includes('--pdf-only');

// ─── Stale-string guard ────────────────────────────────────────────────────
// These strings must NOT appear in the corrected manual files.
// If any are found, the build fails and reports the location.
const STALE_STRINGS = [
  { pattern: 'constraints.xdc', reason: 'XDC filename was corrected to "top.xdc"' },
  { pattern: 'top_tb',          reason: 'Testbench entity was corrected to "tb_top"' },
  { pattern: '"Write HDL"',     reason: 'Import tab label was corrected to "Paste HDL"' },
  { pattern: 'up to seven',     reason: 'Hint count was corrected to "14 diagnostic conditions"' },
  { pattern: 'up to 7 fact',    reason: 'Hint count was corrected to "14 diagnostic conditions"' },
];

// ─── Helper functions ──────────────────────────────────────────────────────
function log(msg)  { console.log(`  ✓  ${msg}`); }
function warn(msg) { console.warn(`  ⚠  ${msg}`); }
function fail(msg) { console.error(`  ✗  ${msg}`); process.exit(1); }

function checkExists(file, label) {
  if (!existsSync(file)) fail(`${label} not found: ${file}`);
  log(`Found ${label}`);
}

function checkStaleStrings(file, label) {
  const { readFileSync } = await import('fs');
  // Use synchronous read for simplicity
  const { readFileSync: rfs } = await import('fs').then(m => m).catch(() => ({ readFileSync: require('fs').readFileSync }));

  // Pure sync approach:
  const { execSync: es } = await import('child_process').then(m => m).catch(() => ({ execSync: require('child_process').execSync }));
  let hadError = false;
  for (const { pattern, reason } of STALE_STRINGS) {
    try {
      const result = execSync(`grep -n "${pattern}" "${file}" 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      if (result) {
        console.error(`\n  ✗  STALE CONTENT in ${label}:`);
        console.error(`     Pattern: "${pattern}"`);
        console.error(`     Reason:  ${reason}`);
        console.error(`     Found at:\n${result.split('\n').map(l => '       ' + l).join('\n')}`);
        hadError = true;
      }
    } catch { /* grep returns non-zero on no match; already handled */ }
  }
  return hadError;
}

// ─── Main ──────────────────────────────────────────────────────────────────
console.log('\nRedByte Product Manual Build\n');

// Step 1: Verify source files
console.log('Step 1: Checking source files...');
checkExists(HTML_SRC, 'HTML companion');
checkExists(MD_SRC,   'Markdown source');
log('Source files OK');

if (!PDF_ONLY) {
  // Step 2: Stale-string validation
  console.log('\nStep 2: Stale-string validation...');
  let anyError = false;

  for (const { pattern, reason } of STALE_STRINGS) {
    for (const [file, label] of [[MD_SRC, 'Markdown'], [HTML_SRC, 'HTML']]) {
      try {
        const result = execSync(
          `grep -in "${pattern}" "${file}" 2>/dev/null || true`,
          { encoding: 'utf8' }
        ).trim();
        if (result) {
          console.error(`\n  ✗  STALE CONTENT in ${label}:`);
          console.error(`     Pattern: "${pattern}"`);
          console.error(`     Reason:  ${reason}`);
          console.error(`     Lines:\n${result.split('\n').map(l => '       ' + l).join('\n')}`);
          anyError = true;
        }
      } catch { /* no-op */ }
    }
  }

  if (anyError) {
    console.error('\n  Build failed: stale strings detected. Apply corrections before regenerating PDF.\n');
    process.exit(1);
  }
  log('No stale strings found');
}

// Step 3: Check weasyprint is available
console.log('\nStep 3: Checking weasyprint...');
const wpCheck = spawnSync('python3', ['-c', 'import weasyprint; print(weasyprint.__version__)'], { encoding: 'utf8' });
if (wpCheck.status !== 0) {
  fail('weasyprint not found. Install with: pip install weasyprint --break-system-packages');
}
log(`weasyprint ${wpCheck.stdout.trim()}`);

// Step 4: Generate PDF
console.log('\nStep 4: Generating PDF...');
const pdfScript = `
import weasyprint, sys
html = weasyprint.HTML(filename=sys.argv[1])
html.write_pdf(sys.argv[2])
`.trim();

const result = spawnSync(
  'python3',
  ['-c', pdfScript, HTML_SRC, PDF_OUT],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
);

if (result.status !== 0) {
  fail(`weasyprint failed:\n${result.stderr}`);
}

const size = statSync(PDF_OUT).size;
const kb   = (size / 1024).toFixed(0);
log(`PDF written: docs/manuals/RedByte_Product_Manual.pdf (${kb} KB)`);

console.log('\nDone.\n');
console.log('  Outputs:');
console.log(`    docs/manuals/RedByte_Product_Manual.pdf  (${kb} KB)`);
console.log('');
