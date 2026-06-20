import { execSync } from 'node:child_process';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

export const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();

export const CLASSROOM_VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

export async function installCleanStudentContext(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    } catch {
      // Storage can be unavailable on intermediate browser documents.
    }
    try {
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable on intermediate browser documents.
    }
  });
}

export function captureBrowserProblems(page) {
  const problems = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      problems.push({ type: message.type(), text, location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    problems.push({ type: 'pageerror', text: error.message });
  });
  return problems;
}

export async function openLogicGatesStarter(page, baseUrl, gateLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=${gateLabel}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

export async function openMode(page, baseUrl, mode, gateLabel) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=${gateLabel}-${mode}`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(120);
}

export async function runComparePass(page) {
  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
}

export async function assertBuildHash(page, label) {
  const rootSha = ((await page.locator('[data-testid="ide-root"]').first().getAttribute('data-build-sha').catch(() => '')) ?? '').trim();
  if (rootSha) {
    assert(rootSha === CURRENT_SHA, `${label}: build sha ${rootSha} != ${CURRENT_SHA}`);
    return;
  }
  const visibleSha = ((await page.locator('.ide-build-badge-sha').first().textContent({ timeout: 1000 }).catch(() => '')) ?? '').trim();
  assert(visibleSha === CURRENT_SHA, `${label}: build sha ${visibleSha || 'missing'} != ${CURRENT_SHA}`);
}

export async function assertNoRootOverflow(page, label) {
  const state = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  assert(
    state.documentWidth <= state.viewportWidth + 1,
    `${label}: root horizontal overflow ${state.documentWidth - state.viewportWidth}px`
  );
}

export async function firstVisibleRect(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const empty = { selector: null, visible: false, top: 0, left: 0, width: 0, height: 0, visibleWidth: 0, visibleHeight: 0 };
    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, bounds.right) - Math.max(0, bounds.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, bounds.bottom) - Math.max(0, bounds.top));
      const visible =
        bounds.width > 1 &&
        bounds.height > 1 &&
        visibleWidth > 1 &&
        visibleHeight > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
      if (visible) {
        return {
          selector,
          visible,
          top: Math.round(bounds.top),
          left: Math.round(bounds.left),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
          visibleWidth: Math.round(visibleWidth),
          visibleHeight: Math.round(visibleHeight),
        };
      }
    }
    return empty;
  }, selectors);
}

export async function assertVisibleRect(page, selectors, label, options = {}) {
  const rect = await firstVisibleRect(page, selectors);
  assert(rect.visible, `${label}: missing visible region for ${selectors.join(', ')}`);
  if (options.maxTop != null) {
    assert(rect.top <= options.maxTop, `${label}: starts too low (${rect.top}px > ${options.maxTop}px)`);
  }
  if (options.minWidth != null) {
    assert(rect.visibleWidth >= options.minWidth, `${label}: too narrow (${rect.visibleWidth}px < ${options.minWidth}px)`);
  }
  if (options.minHeight != null) {
    assert(rect.visibleHeight >= options.minHeight, `${label}: too short (${rect.visibleHeight}px < ${options.minHeight}px)`);
  }
  return rect;
}
