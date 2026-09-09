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
  assert(normalize(await enableRow.locator('th[scope="row"]').textContent()) === 'EN', 'Main mapping row must retain logical signal EN');
  assert(normalize(await page.getByTestId('ide-hw-map-row-binding-en').textContent()) === 'SW0', 'Main mapping row must expose compatible board resource SW0');
  assert(normalize(await page.getByTestId('ide-hw-map-row-status-en').textContent()) === 'Assigned', 'Main mapping row must expose assignment state');

  await page.getByTestId('ide-hw-map-row-action-en').click();
  assert(normalize(await page.getByTestId('ide-hardware-chain-artifact').locator('strong').textContent()) === 'SW', 'Selected mapping detail must expose generated artifact port SW');
  assert(normalize(await page.getByTestId('ide-hardware-chain-board').locator('strong').textContent()) === 'SW0', 'Selected mapping detail must expose board resource SW0');
  assert(normalize(await page.getByTestId('ide-hardware-chain-pin').locator('strong').textContent()) === 'V17', 'Selected mapping detail must expose package pin V17');
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
  const contentLines = await page.locator('[data-testid="ide-export-preview-code"] .rb-pkg-code-line > span:last-child').allTextContents();
  assert(contentLines.length > 0, `Artifact ${path} must render its code content`);
  return normalize(contentLines.join('\n'));
}

function normalize(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}
