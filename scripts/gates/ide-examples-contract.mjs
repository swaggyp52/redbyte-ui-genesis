#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE examples catalog and guarded open contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const examplesPanel = page.locator('[data-testid="ide-project-examples"]');
  assert(await visible(examplesPanel), 'project examples panel should be visible');

  const cards = examplesPanel.locator('[data-testid^="ide-example-card-"]');
  const cardCount = await cards.count();
  assert(cardCount >= 3, `expected >=3 example cards, found ${cardCount}`);

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-design-add-io-pins"]').click();

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const targetOpen = page.locator('[data-testid="ide-open-example-and-gate-basics"]');
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

  const loadedState = page.locator('[data-testid="ide-example-card-and-gate-basics"] .ide-status-pill');
  const loadedLabel = await loadedState.first().innerText();
  assert(
    loadedLabel.trim().toUpperCase().includes('LOADED'),
    `loaded example card should show LOADED status, got \"${loadedLabel.trim()}\"`
  );
});
