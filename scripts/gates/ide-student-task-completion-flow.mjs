#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE student task completion flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runStudentCompletionFlow(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Student task flow browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Student task flow failures:\n${failures.join('\n')}`);
});

async function runStudentCompletionFlow(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=student-task-completion-flow-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertDesignDirectManipulation(page, viewport);

  await openMode(page, baseUrl, 'verify', `student-task-completion-flow-${viewport.label}`);
  await assertVerifyFailRepairPass(page, viewport);

  await openMode(page, baseUrl, 'hardware', `student-task-completion-flow-${viewport.label}`);
  await assertHardwareMappingWorkbench(page, viewport);

  await openMode(page, baseUrl, 'export', `student-task-completion-flow-${viewport.label}`);
  await assertExportHandoff(page, viewport);

  await assertNoRootOverflow(page, `${viewport.label}/Student task flow`);
}

async function assertDesignDirectManipulation(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Design`);
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });

  await selectAndGate(page);
  await page.waitForSelector('[data-testid="ide-design-selection-inspector"]', { timeout: 10000 });

  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleWidth: Math.round(Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left))),
        visibleHeight: Math.round(Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))),
      };
    };

    const actionButtons = Array.from(
      document.querySelectorAll(
        '[data-testid="ide-design-inspector-actions"] button,' +
          '[data-testid="ide-design-inspector-actions"] [role="button"]'
      )
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.textContent?.replace(/\s+/g, ' ').trim() || element.getAttribute('aria-label') || 'button',
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visibleWidth: Math.round(Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left))),
          visibleHeight: Math.round(Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))),
        };
      });

    const overlaps = [];
    for (let i = 0; i < actionButtons.length; i += 1) {
      for (let j = i + 1; j < actionButtons.length; j += 1) {
        const a = actionButtons[i];
        const b = actionButtons[j];
        const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (overlapX > 2 && overlapY > 2) {
          overlaps.push(`${a.label} overlaps ${b.label}`);
        }
      }
    }

    return {
      dock: box('[data-testid="ide-inspector"]'),
      inspector: box('[data-testid="ide-design-selection-inspector"]'),
      actions: box('[data-testid="ide-design-inspector-actions"]'),
      editGroup: box('[data-testid="ide-design-inspector-edit-group"]'),
      swapGroup: box('[data-testid="ide-design-swap-group"]'),
      canvas: box('[data-testid="ide-design-live-canvas"]'),
      actionButtons,
      overlaps,
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });

  assert(metrics.dock?.visibleWidth >= 260, `${viewport.label}: Design inspector dock too narrow ${JSON.stringify(metrics.dock)}`);
  assert(
    metrics.inspector?.visibleWidth >= 224,
    `${viewport.label}: selected-node inspector content too narrow ${JSON.stringify(metrics.inspector)}`
  );
  assert(
    metrics.canvas?.visibleWidth >= Math.round(viewport.width * 0.44),
    `${viewport.label}: Design canvas lost primary workspace ${JSON.stringify(metrics.canvas)}`
  );
  assert(metrics.actions?.visibleHeight >= 120, `${viewport.label}: inspector actions not usefully visible ${JSON.stringify(metrics.actions)}`);
  assert(metrics.editGroup?.top < viewport.height - 180, `${viewport.label}: edit actions start too low ${JSON.stringify(metrics.editGroup)}`);
  assert(
    metrics.swapGroup?.visibleHeight >= 56 && metrics.swapGroup?.top < viewport.height - 40,
    `${viewport.label}: Swap type controls are not usefully reachable in the inspector ${JSON.stringify(metrics.swapGroup)}`
  );
  assert(metrics.overlaps.length === 0, `${viewport.label}: inspector action buttons overlap: ${metrics.overlaps.join(', ')}`);
  assert(metrics.rootOverflowX <= 1, `${viewport.label}: Design created root overflow ${metrics.rootOverflowX}px`);
}

async function selectAndGate(page) {
  const candidates = [
    '[data-node-id="and_node"]',
    '[data-testid="node-AND-and_node"]',
    '[data-testid^="node-AND-"]',
  ];
  for (const selector of candidates) {
    const node = page.locator(selector).first();
    if (!(await node.isVisible().catch(() => false))) continue;
    await node.click({ force: true });
    return;
  }

  const selected = await page.evaluate(() => {
    const node = Array.from(document.querySelectorAll('[data-node-id]')).find((element) =>
      /AND/i.test(element.textContent || element.getAttribute('data-testid') || '')
    );
    if (!(node instanceof HTMLElement)) return false;
    node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
    return true;
  });
  assert(selected, 'Design canvas must expose a selectable AND gate after loading Half Adder');
}

async function assertVerifyFailRepairPass(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Verify`);
  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Verify Compare mode must be selectable`);
  let status = await clickRunAndReadStatus(page);
  assert(isVerifyPass(status), `${viewport.label}: Verify should pass saved checks, got "${status}"`);
  assert(await visible(page.locator('[data-testid="ide-verify-region-waveform"]').first()), `${viewport.label}: Verify waveform region missing`);
  assert(await visible(page.locator('[data-testid="ide-verify-region-stimulus"]').first()), `${viewport.label}: Verify stimulus region missing`);

  const target = await pickExpectedCell(page);
  await clickExpectedCellToValue(page, target, target.value === 0 ? 1 : 0);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare must remain selectable after expected edit`);
  status = await clickRunAndReadStatus(page);
  assert(isVerifyFail(status), `${viewport.label}: edited expected output should FAIL Compare, got "${status}"`);

  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare must remain selectable after expected repair`);
  status = await clickRunAndReadStatus(page);
  assert(isVerifyPass(status), `${viewport.label}: repaired expected output should PASS Compare, got "${status}"`);

  await assertNoRootOverflow(page, `${viewport.label}/Verify`);
}

async function clickRunAndReadStatus(page) {
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(nextHash && nextHash !== previous);
    },
    previousReportHash,
    { timeout: 20000 }
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  return ((await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function pickExpectedCell(page) {
  const cells = await page.locator('[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') ?? '';
      const title = element.getAttribute('title') ?? '';
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(title);
      return {
        testId,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
      };
    })
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `expected at least one saved expected-output cell, got ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readExpectedCellValue(page, target.testId);
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(120);
  }
  const current = await readExpectedCellValue(page, target.testId);
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}

async function readExpectedCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function assertHardwareMappingWorkbench(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Hardware`);
  const board = page.locator('[data-testid="ide-hw-map-board"]').first();
  const table = page.locator('[data-testid="ide-hw-map-table"]').first();
  assert(await visible(board), `${viewport.label}: Hardware board map missing`);
  assert(await visible(table), `${viewport.label}: Hardware signal mapping table missing`);
  const text = ((await page.locator('[data-testid="ide-mode-hardware"]').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
  assert(/SW0|SW1|LD0|LD1|V17|V16|U16|E19/i.test(text), `${viewport.label}: Hardware must expose real Basys3 pin mapping context`);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware`);
}

async function assertExportHandoff(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Export`);
  const readinessHero = page.locator('[data-testid="ide-export-readiness-hero"]').first();
  assert(await visible(readinessHero), `${viewport.label}: Export readiness authority missing`);
  const readinessDetails = page.locator('.ide-export-package-readiness-details').first();
  if (!(await readinessDetails.getAttribute('open'))) {
    await readinessDetails.locator('summary').first().click();
  }
  const checklist = page.locator('[data-testid="ide-export-handoff-checklist-v1"]').first();
  assert(await visible(checklist), `${viewport.label}: Export handoff checklist missing`);
  const text = ((await page.locator('[data-testid="ide-mode-export"]').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
  assert(/E0/i.test(text), `${viewport.label}: Export must state E0 package boundary`);
  assert(/Verify|Compare/i.test(text), `${viewport.label}: Export must carry Verify state forward`);
  assert(/Pin|Mapping|Basys3/i.test(text), `${viewport.label}: Export must carry pin mapping context forward`);
  assert(
    !/E1\s+(ready|passed|complete)|E2\s+(ready|passed|complete)|E3\s+(ready|passed|complete)|board observed/i.test(text),
    `${viewport.label}: Export must not claim external hardware proof`
  );
  await assertNoRootOverflow(page, `${viewport.label}/Export`);
}
