#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE examples catalog and guarded open contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const examplesPanel = page.locator('[data-testid="ide-project-start-dock"]');
  assert(await visible(examplesPanel), 'project start dock should be visible');

  const groups = examplesPanel.locator('[data-testid^="ide-project-example-group-"]');
  const groupCount = await groups.count();
  assert(groupCount >= 2, `expected >=2 grouped example sections, found ${groupCount}`);

  const cards = examplesPanel.locator('[data-testid^="ide-project-open-example-"]');
  const cardCount = await cards.count();
  assert(cardCount >= 3, `expected >=3 example launch rows, found ${cardCount}`);

  const metadataRows = examplesPanel.locator('[data-testid^="ide-project-example-meta-"]');
  const metadataCount = await metadataRows.count();
  assert(
    metadataCount >= 3,
    `expected metadata rows for grouped examples, found ${metadataCount}`
  );

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-design-add-io-pins"]').click();

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const targetOpen = page.locator('[data-testid="ide-project-open-example-and-gate-basics"]');
  assert(await visible(targetOpen), 'AND starter open button should be visible');
  await targetOpen.click();

  const confirmModal = page.locator('[data-testid="ide-example-confirm-modal"]');
  assert(await visible(confirmModal), 'confirm modal must appear when unsaved work exists');

  await page.locator('[data-testid="ide-example-cancel"]').click();
  const hiddenAfterCancel = await confirmModal.isVisible().catch(() => false);
  assert(!hiddenAfterCancel, 'confirm modal should close after cancel');

  await targetOpen.click();
  await page.locator('[data-testid="ide-example-confirm"]').click();
  const hiddenAfterConfirm = await confirmModal.isVisible().catch(() => false);
  assert(!hiddenAfterConfirm, 'confirm modal should close after confirm');

  const projectName = await page.locator('.ide-project-name').first().innerText();
  assert(
    projectName.trim() === 'AND Gate Starter',
    `project name should update after loading example, got \"${projectName.trim()}\"`
  );

  const loadedButtonClass = await targetOpen.getAttribute('class');
  assert(
    (loadedButtonClass ?? '').includes('is-active'),
    `loaded example row should be active, got class \"${loadedButtonClass ?? ''}\"`
  );
});
