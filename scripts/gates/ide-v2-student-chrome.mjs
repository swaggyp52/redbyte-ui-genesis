#!/usr/bin/env node

/**
 * RedByte V2 student chrome gate.
 *
 * The student UI must not expose raw build hashes, E-tier proof jargon, or generic
 * collapsible side rails. Engineering metadata remains available through Help -> Diagnostics.
 */

import { execSync } from 'node:child_process';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const CURRENT_FULL_SHA = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const MODES = [
  { mode: 'project', primitive: 'course-workspace' },
  { mode: 'design', primitive: 'fixed-tool-palette' },
  { mode: 'verify', primitive: 'testbench-workspace' },
  { mode: 'hardware', primitive: 'board-mapping-workspace' },
  { mode: 'export', primitive: 'artifact-workspace' },
  { mode: 'import', primitive: 'step-workflow' },
];

const STUDENT_PROOF_JARGON = [
  /\bE0\s+only\b/i,
  /\bE0\s+(ready|export|handoff|boundary|package)\b/i,
  /\bstale\s+E0\b/i,
  /\bBrowser\s+E0\b/i,
  /\bE1\s*[/-]\s*E3\b/i,
  /\bE1\s*\/\s*E2\s*\/\s*E3\b/i,
  /\bevidence\s+(tier|level)\b/i,
  /\bproof\s+tier\b/i,
];

await runIdeGate('IDE V2 student chrome separates diagnostics from normal UI', async ({ page, baseUrl }) => {
  const problems = captureBrowserProblems(page);

  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    } catch {
      // Ignore storage access on intermediate browser documents.
    }
    try {
      sessionStorage.clear();
    } catch {
      // Ignore storage access on intermediate browser documents.
    }
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=v2-student-chrome-first-${viewport.label}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await assertV2Chrome(page, 'project', 'course-workspace', `${viewport.label} first launch`);
    await assertDiagnosticsMenu(page, `${viewport.label} first launch`);

    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

    for (const { mode, primitive } of MODES) {
      await openMode(page, baseUrl, mode, `${viewport.label}-${mode}`);
      await assertV2Chrome(page, mode, primitive, `${viewport.label} loaded ${mode}`);
    }
  }

  assert(
    problems.length === 0,
    `browser emitted console/page errors:\n${problems.map((problem) => `${problem.type}: ${problem.text}`).join('\n')}`
  );
});

async function openMode(page, baseUrl, mode, gateLabel) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=v2-student-chrome-${gateLabel}`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(100);
}

async function assertV2Chrome(page, mode, primitive, label) {
  const root = page.locator('[data-testid="ide-root"]').first();
  assert(await visible(root), `${label}: IDE root must be visible`);
  assert(
    (await root.getAttribute('data-student-ui-contract')) === 'v2',
    `${label}: IDE root must declare the V2 student UI contract`
  );
  assert(
    (await root.getAttribute('data-build-sha')) === CURRENT_SHA,
    `${label}: root build sha must match local HEAD ${CURRENT_SHA}`
  );
  assert(
    (await root.getAttribute('data-build-full-sha')) === CURRENT_FULL_SHA,
    `${label}: root full build sha must match local HEAD ${CURRENT_FULL_SHA}`
  );

  const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
  assert(await visible(modeRoot), `${label}: ${mode} root must be visible`);
  const rootWorkspaceFoundation = await modeRoot.getAttribute('data-workspace-foundation').catch(() => null);
  const shell = rootWorkspaceFoundation
    ? modeRoot
    : modeRoot.locator('[data-workspace-foundation="v2"]').first();
  if (rootWorkspaceFoundation || (await shell.count())) {
    assert(await visible(shell), `${label}: workbench shell must be visible`);
    assert(
      (await shell.getAttribute('data-workspace-foundation')) === 'v2',
      `${label}: workbench shell must declare the V2 workspace foundation`
    );
    assert(
      (await shell.getAttribute('data-workspace-primitive')) === primitive,
      `${label}: ${mode} must use workspace primitive ${primitive}`
    );
  } else {
    assert(mode === 'project', `${label}: only Project may render outside IdeWorkbenchShell`);
  }

  const visibleText = await page.locator('body').innerText({ timeout: 5000 });
  assert(!visibleText.includes(CURRENT_SHA), `${label}: raw build hash is visible in normal student UI`);
  assert(!visibleText.includes(CURRENT_FULL_SHA), `${label}: full build hash is visible in normal student UI`);
  assert(!/\bBUILD\s+[0-9a-f]{6,40}\b/i.test(visibleText), `${label}: build badge text is visible`);
  assert(!/\bSupport(?:\s+context|:)/i.test(visibleText), `${label}: support-rail wording is visible`);
  assert(!/\bChecks\s+(synced|need review|flagged)\b/i.test(visibleText), `${label}: old check-status wording is visible`);
  assert(!/\bEvidence\b\s+\bE0\b/i.test(visibleText), `${label}: old evidence ribbon wording is visible`);

  for (const pattern of STUDENT_PROOF_JARGON) {
    assert(!pattern.test(visibleText), `${label}: proof jargon leaked into normal UI via ${pattern}`);
  }

  const studentStatus = page.locator('[data-testid="ide-proof-ribbon-evidence"]').first();
  assert(await visible(studentStatus), `${label}: student workspace status must remain visible`);
  const studentStatusText = await studentStatus.innerText();
  assert(/Workspace/i.test(studentStatusText), `${label}: status ribbon must use workspace language`);
  assert(!/Evidence|E0|E1|E2|E3/i.test(studentStatusText), `${label}: status ribbon must not use E-tier language`);

  for (const selector of [
    '[data-testid="ide-build-badge"]',
    '[data-testid="ide-workbench-dock-toggle-left"]',
    '[data-testid="ide-workbench-dock-toggle-right"]',
    '[data-testid="ide-workbench-dock-collapse-left"]',
    '[data-testid="ide-workbench-dock-collapse-right"]',
  ]) {
    assert(
      !(await page.locator(selector).first().isVisible().catch(() => false)),
      `${label}: ${selector} must not be visible in normal student chrome`
    );
  }

  await assertNoRootOverflow(page, label);
}

async function assertDiagnosticsMenu(page, label) {
  const beforeText = await page.locator('body').innerText({ timeout: 5000 });
  assert(!beforeText.includes(CURRENT_SHA), `${label}: build hash must be hidden before diagnostics opens`);

  const helpButton = page.locator('[data-testid="ide-topbar-help-btn"]').first();
  assert(await visible(helpButton), `${label}: Help button must be visible`);
  await helpButton.click();

  const menu = page.locator('[data-testid="ide-help-menu-popover"]').first();
  assert(await visible(menu), `${label}: Help menu must open`);
  assert(/About RedByte/i.test(await menu.innerText()), `${label}: Help menu must include About`);
  assert(/Diagnostics/i.test(await menu.innerText()), `${label}: Help menu must include Diagnostics`);

  await page.locator('[data-testid="ide-help-diagnostics"]').first().click();
  const dialog = page.locator('[data-testid="ide-diagnostics-dialog"]').first();
  assert(await visible(dialog), `${label}: Diagnostics dialog must open`);
  const dialogText = await dialog.innerText();
  assert(dialogText.includes(CURRENT_FULL_SHA), `${label}: Diagnostics must expose the full build fingerprint`);
  assert(/Build fingerprint/i.test(dialogText), `${label}: Diagnostics must label the build fingerprint`);
  assert(/external build and board records are separate/i.test(dialogText), `${label}: Diagnostics must explain the external proof boundary`);
  assert(!/\bE0\b|\bE1\b|\bE2\b|\bE3\b/.test(dialogText), `${label}: Diagnostics must use plain-language proof boundaries`);

  await page.locator('[data-testid="ide-help-dialog-close"]').first().click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 });
  const afterText = await page.locator('body').innerText({ timeout: 5000 });
  assert(!afterText.includes(CURRENT_SHA), `${label}: build hash must be hidden after diagnostics closes`);
}

async function assertNoRootOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  const overflow = metrics.documentWidth - metrics.viewportWidth;
  assert(overflow <= 1, `${label}: root horizontal overflow ${overflow}px`);
}

function captureBrowserProblems(page) {
  const problems = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      problems.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => {
    problems.push({ type: 'pageerror', text: error.message });
  });
  return problems;
}
