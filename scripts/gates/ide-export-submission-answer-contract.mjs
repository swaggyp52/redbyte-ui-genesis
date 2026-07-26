#!/usr/bin/env node

/**
 * Export submission-answer first-viewport gate.
 *
 * Contract:
 * 1) The package decision answers "What should I submit?" without scrolling.
 * 2) Trust axes and the owning Export actions remain visible beside that answer.
 * 3) The detailed five-role guide and generated-file workspace remain present.
 * 4) Draft and current Compare PASS states satisfy the contract at classroom viewports.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
];
const OUTPUT_DIR = path.resolve('.redbyte/product-immersion/unified-v3-rc/export-submission-answer-contract');
const REQUIRED_ROLES = ['project', 'source', 'constraints', 'simulation', 'readme'];

await runIdeGate('IDE export submission answer first-viewport contract satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await installCleanStudentContext(page);

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=export-submission-answer-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
      await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
      await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });

      await openMode(page, 'export');
      await assertExportAnswer(page, `${viewport.label}/draft`);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${viewport.label}-draft-first-viewport.png`),
        fullPage: false,
      });

      await openMode(page, 'verify');
      await ensureVerifyVectorsReady(page);
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode is unavailable`);
      await clickVerifyRun(page);
      await waitForVerifyResult(page, { timeout: 20000 });
      const verifyStatus = await normalizedText(page.getByTestId('ide-verify-summary-status').first());
      assert(isVerifyPass(verifyStatus), `${viewport.label}: Compare did not PASS: ${verifyStatus}`);

      await openMode(page, 'export');
      const trusted = await assertExportAnswer(page, `${viewport.label}/current Compare PASS`);
      assert(
        trusted.verificationTrust === 'trusted',
        `${viewport.label}: Export did not preserve trusted current Compare evidence: ${JSON.stringify(trusted)}`,
      );
      assert(
        /Build Current Bundle|Rebuild Current Bundle|Download Package/i.test(trusted.actionText),
        `${viewport.label}: trusted Export action is missing: ${trusted.actionText}`,
      );
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${viewport.label}-trusted-first-viewport.png`),
        fullPage: false,
      });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Export submission-answer browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Export submission-answer failures:\n${failures.join('\n')}`);
});

async function openMode(page, mode) {
  const button = page.getByTestId(`mode-button-${mode}`).first();
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(120);
}

async function assertExportAnswer(page, label) {
  const inspector = page.getByTestId('ide-export-package-inspector-v1').first();
  await inspector.waitFor({ state: 'visible', timeout: 15000 });
  const state = await page.evaluate((roles) => {
    const measure = (testId) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
        top: Math.round(rect.top * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        left: Math.round(rect.left * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        fontSize: Number.parseFloat(style.fontSize),
        clipped: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1,
        visible: rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
        fullyInsideViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1 && rect.left >= -1 && rect.right <= innerWidth + 1,
      };
    };
    const roleCount = roles.filter((role) =>
      document.querySelector(`[data-testid="ide-export-submission-role-${role}"]`),
    ).length;
    const inspectorElement = document.querySelector('[data-testid="ide-export-package-inspector-v1"]');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      answer: measure('ide-export-submission-answer'),
      axes: measure('ide-export-trust-axes'),
      actions: measure('ide-export-primary-actions'),
      detailedGuidePresent: Boolean(document.querySelector('[data-testid="ide-export-submission-guidance"]')),
      fileWorkspacePresent: Boolean(document.querySelector('[data-testid="ide-export-package-files"]')),
      roleCount,
      verificationTrust: inspectorElement?.getAttribute('data-export-verification-trust') ?? '',
    };
  }, REQUIRED_ROLES);

  assert(state.answer?.visible, `${label}: submission answer is missing: ${JSON.stringify(state)}`);
  assert(state.answer.fullyInsideViewport, `${label}: submission answer is not wholly inside the initial viewport: ${JSON.stringify(state)}`);
  assert(state.answer.fontSize >= 13, `${label}: submission answer text floor failed: ${JSON.stringify(state.answer)}`);
  assert(!state.answer.clipped, `${label}: submission answer is intrinsically clipped: ${JSON.stringify(state.answer)}`);
  assert(/What should I submit\?/i.test(state.answer.text), `${label}: answer prompt is missing: ${state.answer.text}`);
  for (const artifact of ['top.vhd', 'top.xdc', 'testbench.vhd']) {
    assert(state.answer.text.includes(artifact), `${label}: submission answer omits ${artifact}: ${state.answer.text}`);
  }
  assert(state.axes?.visible && state.axes.fullyInsideViewport, `${label}: trust axes are no longer visible with the answer: ${JSON.stringify(state.axes)}`);
  assert(state.actions?.visible && state.actions.fullyInsideViewport, `${label}: Export actions are no longer visible with the answer: ${JSON.stringify(state.actions)}`);
  assert(state.detailedGuidePresent && state.roleCount === REQUIRED_ROLES.length, `${label}: detailed five-role guide was removed: ${JSON.stringify(state)}`);
  assert(state.fileWorkspacePresent, `${label}: generated-file workspace was removed`);
  await assertNoRootOverflow(page, label);

  return {
    ...state,
    actionText: await normalizedText(page.getByTestId('ide-export-primary-actions').first()),
  };
}

async function normalizedText(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
