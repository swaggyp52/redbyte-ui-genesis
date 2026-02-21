// Gate: professor import reality contract
// Tests a realistic Vivado-style nested project ZIP end-to-end.
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { runIdeGate, assert } from './_gateHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip'
);

await runIdeGate('IDE professor import reality contract', async ({ page, baseUrl }) => {
  // 1. Navigate to Import mode
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });

  // 2. Upload nested Vivado ZIP fixture
  const zipBytes = readFileSync(FIXTURE_PATH);
  const zipInput = page.locator('[data-testid="ide-import-zip-input"]');
  await zipInput.setInputFiles({
    name: '02-vivado-nested-andgate.zip',
    mimeType: 'application/zip',
    buffer: zipBytes,
  });

  // 3. Wait for inspection panel
  await page.waitForSelector('[data-testid="ide-import-zip-inspection"]', { timeout: 15000 });

  // 4. Check top HDL path points into sources_1/
  const topPath = await page
    .locator('[data-testid="ide-import-zip-top-path"]')
    .textContent()
    .catch(() => '');
  assert(
    topPath?.includes('sources_1') && topPath?.includes('top.vhd'),
    `top path must include sources_1/...top.vhd, got "${topPath}"`
  );

  // 5. Check XDC path points into constrs_1/
  const xdcPath = await page
    .locator('[data-testid="ide-import-zip-xdc-path"]')
    .textContent()
    .catch(() => '');
  assert(
    xdcPath?.includes('constrs_1') && xdcPath?.includes('basys3.xdc'),
    `xdc path must include constrs_1/...basys3.xdc, got "${xdcPath}"`
  );

  // 6. Apply to project
  const applyBtn = page.locator('[data-testid="ide-import-build-project"]');
  const applyDisabled = await applyBtn.getAttribute('disabled');
  assert(applyDisabled === null, 'Apply button must not be disabled');
  await applyBtn.click();

  // Handle confirmation dialog if present
  const confirmBtn = page.locator('[data-testid="ide-import-apply-confirm"]');
  const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (confirmVisible) {
    await confirmBtn.click();
  }

  // 7. Navigate to Project and confirm ioRows populated
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const ioRows = await page
    .locator('[data-testid="ide-project-mapping-table"] tr')
    .count();
  assert(ioRows >= 4, `mapping table must have header + >=3 rows (3 ports), got ${ioRows}`);

  // 8. Navigate to Design and confirm circuit has nodes
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const nodeCount = await page.locator('[data-node-id]').count();
  assert(nodeCount >= 2, `design must have >=2 nodes (at least ports), got ${nodeCount}`);
});
