#!/usr/bin/env node

/**
 * Mapping preview/package agreement gate.
 *
 * Proves one divergent semantic binding (EN -> SW -> SW0/V17) agrees across
 * Map Pins, the generated top.xdc preview, and the manifest-first package.
 */

import {
  assert,
  loadStarterProject,
  runIdeGate,
} from './_gateHarness.mjs';

const EXPECTED_XDC_LINE = 'set_property PACKAGE_PIN V17 [get_ports {SW}]';

await runIdeGate('IDE mapping preview/package agreement satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=mapping-preview-package-agreement`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });

  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });

  const enableRow = page.locator('[data-testid="ide-hw-map-row-en"]').first();
  await enableRow.waitFor({ state: 'visible', timeout: 15000 });
  const enableRowText = normalize(await enableRow.textContent());
  assert(/^EN(?:Artifact|\b)/.test(enableRowText), `Map Pins must retain logical signal EN; got "${enableRowText}"`);
  assert(enableRowText.includes('Artifact SW'), `Map Pins must expose generated artifact port SW; got "${enableRowText}"`);
  assert(enableRowText.includes('Slide switch SW0'), `Map Pins must expose board resource SW0; got "${enableRowText}"`);
  assert(enableRowText.includes('V17'), `Map Pins must expose package pin V17; got "${enableRowText}"`);

  await enableRow.click();
  const mapXdc = normalize(
    await page.locator('[data-testid="ide-hardware-basys3-binding-xdc"]').textContent(),
  );
  assert(mapXdc.includes(EXPECTED_XDC_LINE), 'Map Pins XDC preview must use artifact port SW');

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 15000 });

  const exportXdc = await readArtifact(page, 'top.xdc');
  assert(exportXdc.includes(EXPECTED_XDC_LINE), 'Export top.xdc must match Map Pins exact PACKAGE_PIN line');

  const manifestText = await readArtifact(page, 'project.rbproj.json');
  const manifest = JSON.parse(manifestText);
  const manifestXdc = String(manifest?.fpga?.constraints?.text ?? '');
  const manifestTop = (manifest?.hdl?.sources ?? []).find((source) => source?.path === 'top.vhd');
  assert(manifestXdc.includes(EXPECTED_XDC_LINE), 'Manifest-owned XDC must match the generated package');
  assert(/\bSW\s*:\s*in\s+STD_LOGIC\b/i.test(String(manifestTop?.text ?? '')), 'Manifest-owned top.vhd must declare artifact port SW');
});

async function readArtifact(page, path) {
  const button = page
    .locator('button[data-testid^="ide-export-file-"]')
    .filter({ hasText: path })
    .first();
  await button.waitFor({ state: 'visible', timeout: 15000 });
  await button.click();
  await page.waitForFunction(
    (expectedPath) =>
      (document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent ?? '').trim() === expectedPath,
    path,
    { timeout: 10000 },
  );
  return normalize(
    await page.locator('[data-testid="ide-export-preview-code"]').first().textContent(),
  );
}

function normalize(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}
