#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  assertVisibleRect,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE Project loaded command surface satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `project-loaded-command-surface-${viewport.label}`);
      await openMode(page, baseUrl, 'project', `project-loaded-command-surface-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      assert(
        (await page.locator('[data-testid^="ide-product-spine-"]:visible').count()) === 0,
        `${viewport.label}: retired duplicate product spine must stay absent`,
      );
      const commandRect = await assertVisibleRect(page, ['[data-testid="ide-project-command-board-v1"]'], `${viewport.label}/Project command board`, {
        maxTop: 240,
        minWidth: Math.round(viewport.width * 0.52),
        minHeight: 88,
      });
      assert(
        commandRect.top >= 56,
        `${viewport.label}: Project command board must sit below the compact top bar, got top=${commandRect.top}`
      );
      assert(
        (await page.locator('[data-testid="ide-project-command-strip-primary-cta"]:visible').count()) === 1,
        `${viewport.label}: loaded Project must expose exactly one body primary action`,
      );
      const stageButtons = page.locator('[data-testid="mode-button-project"], [data-testid="mode-button-design"], [data-testid="mode-button-verify"], [data-testid="mode-button-hardware"], [data-testid="mode-button-export"]');
      assert((await stageButtons.count()) === 5, `${viewport.label}: one five-stage rail must own downstream navigation`);
      assert(await visible(page.locator('[data-testid="mode-button-import"]').first()), `${viewport.label}: Import utility must remain visible`);
      await assertCommandConsoleNotCards(page, viewport);

      const commandText = await normalizedText(page.locator('[data-testid="ide-project-command-board-v1"]').first());
      assert(/current action|next action|continue/i.test(commandText), `${viewport.label}: command board must name the current action`);
      assert(/Design/i.test(commandText), `${viewport.label}: command board must include Design action`);
      assert(/Verify/i.test(commandText), `${viewport.label}: command board must include Verify action`);
      assert(/Continue Design/i.test(commandText), `${viewport.label}: command board must include the dominant Design continuation`);

      const requiredActions = [
        ['[data-testid="ide-project-command-action-design"]', 'design'],
        ['[data-testid="ide-project-command-action-verify"]', 'verify'],
        ['[data-testid="mode-button-hardware"]', 'hardware'],
        ['[data-testid="mode-button-export"]', 'export'],
        ['[data-testid="mode-button-import"]', 'import'],
      ];
      for (const [selector, targetMode] of requiredActions) {
        const action = page.locator(selector).first();
        assert(await visible(action), `${viewport.label}: ${selector} must be visible`);
        assert(!(await action.isDisabled().catch(() => false)), `${viewport.label}: ${selector} must be enabled`);
        await action.click();
        await page.waitForSelector(`[data-testid="ide-mode-${targetMode}"]`, { timeout: 10000 });
        await openMode(page, baseUrl, 'project', `project-loaded-command-surface-${viewport.label}-return`);
      }

      assert(
        await visible(page.locator('[data-testid="ide-project-command-board-v1"]').first()),
        `${viewport.label}: Project command board must survive command navigation`
      );

      await assertNoRootOverflow(page, `${viewport.label}/Project command surface`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Project command surface browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Project command surface failures:\n${failures.join('\n')}`);
});

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function assertCommandConsoleNotCards(page, viewport) {
  const metrics = await page.evaluate((viewportHeight) => {
    const root = document.querySelector('[data-testid="ide-project-command-board-v1"]');
    if (!root) return { rootFound: false, passiveBoxedBlocks: 999, boxedMetricCards: 999, labels: ['missing root'] };

    const candidates = Array.from(
      root.querySelectorAll(
        [
          '.ide-projectx-identity',
          '.ide-projectx-next',
          '.ide-projectx-metric',
          '.ide-project-entry-paths',
        ].join(',')
      )
    );

    const boxed = candidates.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const borderWidth =
        Number.parseFloat(style.borderTopWidth || '0') +
        Number.parseFloat(style.borderRightWidth || '0') +
        Number.parseFloat(style.borderBottomWidth || '0') +
        Number.parseFloat(style.borderLeftWidth || '0');
      const hasVisibleBorder = borderWidth > 0 && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(style.borderTopColor);
      const hasFill = style.backgroundImage !== 'none' || !/rgba\(0,\s*0,\s*0,\s*0\)/.test(style.backgroundColor);
      const isVisible =
        rect.width > 120 &&
        rect.height > 34 &&
        rect.top >= 0 &&
        rect.top < viewportHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
      return isVisible && (hasVisibleBorder || hasFill);
    });

    const boxedMetricCards = boxed.filter((element) => element.classList.contains('ide-projectx-metric')).length;
    return {
      rootFound: true,
      passiveBoxedBlocks: boxed.length,
      boxedMetricCards,
      labels: boxed.map((element) => `${element.tagName.toLowerCase()}.${String(element.className).replace(/\s+/g, '.')}`),
    };
  }, viewport.height);

  assert(metrics.rootFound, `${viewport.label}: Project command console root missing`);
  assert(
    metrics.boxedMetricCards <= 1,
    `${viewport.label}: Project evidence must be compact chips, not ${metrics.boxedMetricCards} boxed metric cards (${metrics.labels.join(' | ')})`
  );
  assert(
    metrics.passiveBoxedBlocks <= 3,
    `${viewport.label}: loaded Project still reads as boxed card stack (${metrics.passiveBoxedBlocks} passive boxes: ${metrics.labels.join(' | ')})`
  );
}
