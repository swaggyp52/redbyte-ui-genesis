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

import { spawnSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
  let hadError = false;
  for (const { pattern, reason } of STALE_STRINGS) {
    const result = findPatternLines(file, pattern);
    if (result.length > 0) {
      console.error(`\n  ✗  STALE CONTENT in ${label}:`);
      console.error(`     Pattern: "${pattern}"`);
      console.error(`     Reason:  ${reason}`);
      console.error(`     Found at:\n${result.map(l => '       ' + l).join('\n')}`);
      hadError = true;
    }
  }
  return hadError;
}

function findPatternLines(file, pattern, options = {}) {
  const needle = options.caseInsensitive ? pattern.toLowerCase() : pattern;
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => {
      const haystack = options.caseInsensitive ? line.toLowerCase() : line;
      return haystack.includes(needle);
    })
    .map(({ line, number }) => `${number}:${line}`);
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
      const result = findPatternLines(file, pattern, { caseInsensitive: true });
      if (result.length > 0) {
        console.error(`\n  ✗  STALE CONTENT in ${label}:`);
        console.error(`     Pattern: "${pattern}"`);
        console.error(`     Reason:  ${reason}`);
        console.error(`     Lines:\n${result.map(l => '       ' + l).join('\n')}`);
        anyError = true;
      }
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
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
const wpCheck = spawnSync(pythonCommand, ['-c', 'import weasyprint; print(weasyprint.__version__)'], { encoding: 'utf8' });
const useWeasyprint = wpCheck.status === 0;
if (useWeasyprint) {
  log(`weasyprint ${wpCheck.stdout.trim()}`);
} else {
  warn('weasyprint is unavailable; using the installed Chromium/Edge print engine');
}

// Step 4: Generate PDF
console.log('\nStep 4: Generating PDF...');
if (useWeasyprint) {
  const pdfScript = `
import weasyprint, sys
html = weasyprint.HTML(filename=sys.argv[1])
html.write_pdf(sys.argv[2])
`.trim();

  const result = spawnSync(
    pythonCommand,
    ['-c', pdfScript, HTML_SRC, PDF_OUT],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (result.status !== 0) {
    fail(`weasyprint failed:\n${result.stderr}`);
  }
} else {
  await generatePdfWithChromium();
}

const size = statSync(PDF_OUT).size;
const kb   = (size / 1024).toFixed(0);
log(`PDF written: docs/manuals/RedByte_Product_Manual.pdf (${kb} KB)`);

console.log('\nDone.\n');
console.log('  Outputs:');
console.log(`    docs/manuals/RedByte_Product_Manual.pdf  (${kb} KB)`);
console.log('');

async function generatePdfWithChromium() {
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(pathToFileURL(HTML_SRC).href, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: PDF_OUT,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    log('Playwright Chromium PDF fallback');
  } catch (error) {
    fail(`Playwright Chromium PDF fallback failed:\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  } finally {
    await browser?.close();
  }
}
