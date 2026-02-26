// Gate: reality-pack contract
// Tests three fixture ZIPs in one run:
//   03 — multi-HDL top ambiguity (top.vhd must win over helper.vhd)
//   04 — XDC port mismatch (warns about "clk" but does not block import)
//   05 — behavioural VHDL (ports-only reconstruction callout)
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { runIdeGate, assert } from './_gateHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(
  __dirname,
  '../../packages/rb-apps/src/fixtures/import/zip'
);

async function navigateToImport(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
}

async function uploadZip(page, fixturePath, filename) {
  const zipBytes = readFileSync(fixturePath);
  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles({
    name: filename,
    mimeType: 'application/zip',
    buffer: zipBytes,
  });
  await page.waitForSelector('[data-testid="ide-import-zip-inspection"]', { timeout: 15000 });
}

async function applyAndConfirm(page) {
  const applyBtn = page.locator('[data-testid="ide-import-process-design"]');
  await applyBtn.click();
  const confirmBtn = page.locator('[data-testid="ide-import-apply-confirm"]');
  const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (confirmVisible) {
    await confirmBtn.click();
  }
}

await runIdeGate('IDE reality-pack contract', async ({ page, baseUrl }) => {
  // ------------------------------------------------------------------
  // Fixture 03: Multi-HDL top ambiguity
  // Expected: top.vhd wins (score 0) over helper.vhd (score 3).
  //           hdlCandidates has 2 entries, top.vhd is first.
  // ------------------------------------------------------------------
  await navigateToImport(page, baseUrl);
  await uploadZip(
    page,
    path.join(FIXTURES_DIR, '03-multi-hdl-ambiguous-top.zip'),
    '03-multi-hdl-ambiguous-top.zip'
  );

  const topPath03 = await page
    .locator('[data-testid="ide-import-zip-top-path"]')
    .textContent()
    .catch(() => '');
  assert(
    topPath03?.includes('top.vhd'),
    `[fx03] top path must include top.vhd, got "${topPath03}"`
  );
  assert(
    !topPath03?.includes('helper.vhd'),
    `[fx03] top path must NOT include helper.vhd, got "${topPath03}"`
  );

  const applyBtn03 = page.locator('[data-testid="ide-import-process-design"]');
  const applyDisabled03 = await applyBtn03.getAttribute('disabled');
  assert(applyDisabled03 === null, '[fx03] Apply button must not be disabled');

  // Apply and navigate to Project
  await applyAndConfirm(page);
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const ioRows03 = await page
    .locator('[data-testid="ide-project-mapping-table"] tr')
    .count();
  assert(
    ioRows03 >= 4,
    `[fx03] mapping table must have header + >=3 rows (3 ports), got ${ioRows03}`
  );

  // ------------------------------------------------------------------
  // Fixture 04: XDC port mismatch + warnings
  // Expected: a, b, y mapped; warning about "clk" (ghost XDC port).
  //           Apply button NOT disabled (mismatch warns but does not block).
  // ------------------------------------------------------------------
  await navigateToImport(page, baseUrl);
  await uploadZip(
    page,
    path.join(FIXTURES_DIR, '04-xdc-port-mismatch.zip'),
    '04-xdc-port-mismatch.zip'
  );

  const topPath04 = await page
    .locator('[data-testid="ide-import-zip-top-path"]')
    .textContent()
    .catch(() => '');
  assert(
    topPath04?.includes('top.vhd'),
    `[fx04] top path must include top.vhd, got "${topPath04}"`
  );

  const xdcPath04 = await page
    .locator('[data-testid="ide-import-zip-xdc-path"]')
    .textContent()
    .catch(() => '');
  assert(
    xdcPath04?.includes('basys3.xdc'),
    `[fx04] xdc path must include basys3.xdc, got "${xdcPath04}"`
  );

  const warningsSection04 = page.locator('[data-testid="ide-import-warnings"]');
  const warningsSectionVisible = await warningsSection04.isVisible({ timeout: 5000 });
  assert(warningsSectionVisible, '[fx04] ide-import-warnings section must be visible');

  const warningsText04 = await warningsSection04.textContent().catch(() => '');
  assert(
    warningsText04?.includes('clk'),
    `[fx04] warnings must mention "clk", got: "${warningsText04?.substring(0, 200)}"`
  );

  const applyBtn04 = page.locator('[data-testid="ide-import-process-design"]');
  const applyDisabled04 = await applyBtn04.getAttribute('disabled');
  assert(applyDisabled04 === null, '[fx04] Apply button must not be disabled (mismatch warns but does not block)');

  // ------------------------------------------------------------------
  // Fixture 05: Behavioural VHDL — ports-only reconstruction
  // Expected: ide-import-recon-partial callout visible; Apply not disabled.
  //           After apply, Project has >=4 mapping rows (3 ports + header).
  // ------------------------------------------------------------------
  await navigateToImport(page, baseUrl);
  await uploadZip(
    page,
    path.join(FIXTURES_DIR, '05-behavioural-ports-only.zip'),
    '05-behavioural-ports-only.zip'
  );

  const reconPartial = page.locator('[data-testid="ide-import-recon-partial"]');
  const reconPartialVisible = await reconPartial.isVisible({ timeout: 5000 });
  assert(reconPartialVisible, '[fx05] ide-import-recon-partial callout must be visible for behavioural HDL');

  const applyBtn05 = page.locator('[data-testid="ide-import-process-design"]');
  const applyDisabled05 = await applyBtn05.getAttribute('disabled');
  assert(applyDisabled05 === null, '[fx05] Apply button must not be disabled for ports-only import');

  // Apply and navigate to Project
  await applyAndConfirm(page);
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const ioRows05 = await page
    .locator('[data-testid="ide-project-mapping-table"] tr')
    .count();
  assert(
    ioRows05 >= 4,
    `[fx05] mapping table must have header + >=3 rows (3 ports), got ${ioRows05}`
  );
});

