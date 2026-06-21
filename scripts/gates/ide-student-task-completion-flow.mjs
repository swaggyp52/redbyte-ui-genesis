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
  assert(metrics.canvas?.visibleWidth >= 640, `${viewport.label}: Design canvas lost primary workspace ${JSON.stringify(metrics.canvas)}`);
  assert(metrics.actions?.visibleHeight >= 120, `${viewport.label}: inspector actions not usefully visible ${JSON.stringify(metrics.actions)}`);
  assert(metrics.editGroup?.top < viewport.height - 180, `${viewport.label}: edit actions start too low ${JSON.stringify(metrics.editGroup)}`);
  assert(
    metrics.swapGroup?.visibleHeight >= 72 && metrics.swapGroup?.top < viewport.height - 64,
    `${viewport.label}: Swap type controls are not usefully visible in first viewport ${JSON.stringify(metrics.swapGroup)}`
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

  await ensureExpectedChecksEditable(page, viewport);
  const target = await pickExpectedCell(page);
  await clickExpectedCellToValue(page, target, target.value === 0 ? 1 : 0);
  await waitForVerifyResultStale(page, viewport, 'expected-output edit');
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare must remain selectable after expected edit`);
  status = await clickRunAndReadStatus(page);
  assert(isVerifyFail(status), `${viewport.label}: edited expected output should FAIL Compare, got "${status}"`);

  await clickExpectedCellToValue(page, target, target.value);
  await waitForVerifyResultStale(page, viewport, 'expected-output repair');
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare must remain selectable after expected repair`);
  status = await clickRunAndReadStatus(page);
  assert(isVerifyPass(status), `${viewport.label}: repaired expected output should PASS Compare, got "${status}"`);

  await assertNoRootOverflow(page, `${viewport.label}/Verify`);
}

async function ensureExpectedChecksEditable(page, viewport) {
  await page.locator('[data-testid="ide-verify-check-authority"]').first().waitFor({ state: 'visible', timeout: 10000 });
  const authority = await page.locator('[data-testid="ide-verify-check-authority"]').first().evaluate((node) => ({
    provenance: node.getAttribute('data-provenance'),
    editable: node.getAttribute('data-editable'),
  }));
  if (authority.provenance === 'student' && authority.editable === 'true') return;

  const duplicateCourseChecks = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  assert(
    await duplicateCourseChecks.isVisible().catch(() => false),
    `${viewport.label}: locked Course checks must expose Duplicate to My checks before fail/repair editing, got ${JSON.stringify(authority)}`
  );
  await duplicateCourseChecks.click();
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
    return authority?.getAttribute('data-provenance') === 'student' &&
      authority?.getAttribute('data-editable') === 'true';
  }, null, { timeout: 10000 }).catch(async () => {
    const snapshot = await readVerifyAuthoritySnapshot(page);
    throw new Error(`${viewport.label}: Duplicate to My checks did not make expected outputs editable: ${JSON.stringify(snapshot)}`);
  });
  const firstExpectedCell = page.locator('button[data-testid^="ide-stimulus-expected-"]:not([disabled])').first();
  await firstExpectedCell.waitFor({ state: 'visible', timeout: 10000 });
  assert(
    !(await firstExpectedCell.isDisabled().catch(() => true)),
    `${viewport.label}: duplicated My checks must make expected-output cells editable`
  );
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
  ).catch(async () => {
    const snapshot = await readVerifyAuthoritySnapshot(page);
    throw new Error(`Verify run did not publish a new report hash: ${JSON.stringify(snapshot)}`);
  });
  await waitForVerifyResult(page, { timeout: 10000 });
  await page.waitForFunction(() => {
    const lastRun = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun ?? null;
    const authority = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    const renderedStatus = authority?.getAttribute('data-result-status') ?? null;
    if (!lastRun || !renderedStatus) return false;
    if (lastRun.status === 'pass') return renderedStatus === 'pass';
    if (lastRun.status === 'fail') return renderedStatus === 'fail';
    return renderedStatus === 'observe' || renderedStatus === 'error';
  }, null, { timeout: 10000 }).catch(async () => {
    const snapshot = await readVerifyAuthoritySnapshot(page);
    throw new Error(`Verify V2 authority did not match runtime status: ${JSON.stringify(snapshot)}`);
  });
  return (await page.locator('[data-testid="ide-verify-v2-authority"]').first().getAttribute('data-result-status')) ?? '';
}

async function readVerifyAuthoritySnapshot(page) {
  return page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.() ?? null;
    const lastRun = runtime?.verifyLastRun ?? null;
    const authority = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    const checkAuthority = document.querySelector('[data-testid="ide-verify-check-authority"]');
    return {
      runtimeStatus: lastRun?.status ?? null,
      runtimeReportHash: lastRun?.reportHash ?? null,
      runtimeRows: lastRun?.report?.rows?.map((row) => ({
        signal: row.signal,
        status: row.status,
        expected: row.expected,
        actual: row.actual,
        tick: row.tick,
        caseIndex: row.caseIndex,
      })).slice(0, 8) ?? [],
      renderedStatus: authority?.getAttribute('data-result-status') ?? null,
      renderedValidity: authority?.getAttribute('data-result-validity') ?? null,
      staleReason: authority?.getAttribute('data-stale-reason-code') ?? null,
      checkProvenance: checkAuthority?.getAttribute('data-provenance') ?? null,
      checkEditable: checkAuthority?.getAttribute('data-editable') ?? null,
      duplicateVisible: Boolean(document.querySelector('[data-testid="ide-verify-duplicate-course-checks"]')),
      enabledExpectedCells: Array.from(document.querySelectorAll('button[data-testid^="ide-stimulus-expected-"]'))
        .filter((element) => element instanceof HTMLButtonElement && !element.disabled && element.getClientRects().length > 0)
        .length,
    };
  });
}

async function waitForVerifyResultStale(page, viewport, reason) {
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    return authority?.getAttribute('data-result-status') === 'stale';
  }, null, { timeout: 10000 }).catch(() => {
    throw new Error(`${viewport.label}: Verify result did not become stale after ${reason}`);
  });
}

async function pickExpectedCell(page) {
  const cells = await page.locator('button[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.filter((element) => {
      if (!(element instanceof HTMLButtonElement)) return false;
      return !element.disabled && element.getClientRects().length > 0;
    }).map((element) => {
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
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readExpectedCellValue(page, target.testId);
    if (current === expectedValue) return;
    const clicked = await clickVisibleExpectedCell(page, target.testId);
    assert(clicked, `expected visible editable expected-output cell ${target.testId}`);
    await page.waitForTimeout(120);
  }
  const current = await readExpectedCellValue(page, target.testId);
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}

async function readExpectedCellValue(page, testId) {
  const title = await page.locator(`button[data-testid="${testId}"]`).evaluateAll((elements) => {
    const element = elements.find((candidate) => (
      candidate instanceof HTMLButtonElement &&
      !candidate.disabled &&
      candidate.getClientRects().length > 0
    ));
    return element?.getAttribute('title') ?? null;
  });
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function clickVisibleExpectedCell(page, testId) {
  return page.locator(`button[data-testid="${testId}"]`).evaluateAll((elements) => {
    const element = elements.find((candidate) => (
      candidate instanceof HTMLButtonElement &&
      !candidate.disabled &&
      candidate.getClientRects().length > 0
    ));
    if (!element) return false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    element.click();
    return true;
  });
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
  const checklist = page.locator('[data-testid="ide-export-handoff-checklist-v1"]').first();
  assert(await visible(checklist), `${viewport.label}: Export handoff checklist missing`);
  const text = ((await page.locator('[data-testid="ide-mode-export"]').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
  assert(/package|handoff|generated files/i.test(text), `${viewport.label}: Export must state package handoff context`);
  assert(/Vivado|board records|outside RedByte|separate/i.test(text), `${viewport.label}: Export must keep downstream build/board records separate`);
  assert(/Verify|Compare/i.test(text), `${viewport.label}: Export must carry Verify state forward`);
  assert(/Pin|Mapping|Basys3/i.test(text), `${viewport.label}: Export must carry pin mapping context forward`);
  assert(
    !/E1\s+(ready|passed|complete)|E2\s+(ready|passed|complete)|E3\s+(ready|passed|complete)|board observed/i.test(text),
    `${viewport.label}: Export must not claim external hardware proof`
  );
  await assertNoRootOverflow(page, `${viewport.label}/Export`);
}
