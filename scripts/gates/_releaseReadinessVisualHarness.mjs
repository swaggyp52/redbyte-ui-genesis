import { assert, loadStarterProject } from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

export const RELEASE_READINESS_VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

export async function openLogicGatesProject(page, baseUrl, gateLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=${gateLabel}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

export async function setupReleaseReadinessPage(page) {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  return browserProblems;
}

export async function openDesignLibrary(page, baseUrl, gateLabel) {
  await openLogicGatesProject(page, baseUrl, gateLabel);
  await assertBuildHash(page, gateLabel);
  await openMode(page, baseUrl, 'design', gateLabel);
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });

  const leftToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  if (await leftToggle.isVisible().catch(() => false)) {
    await leftToggle.click();
    await page.waitForTimeout(180);
  }
  await page.waitForSelector('[data-testid="ide-left-dock"]', { timeout: 5000 });
}

export async function openDesignInspector(page, baseUrl, gateLabel) {
  await openLogicGatesProject(page, baseUrl, gateLabel);
  await assertBuildHash(page, gateLabel);
  await openMode(page, baseUrl, 'design', gateLabel);
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });

  const rightToggle = page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first();
  if (await rightToggle.isVisible().catch(() => false)) {
    await rightToggle.click();
    await page.waitForTimeout(180);
  }
  await page.waitForSelector('[data-testid="ide-inspector"]', { timeout: 5000 });
}

export async function openHardwareMapPins(page, baseUrl, gateLabel) {
  await openLogicGatesProject(page, baseUrl, gateLabel);
  await assertBuildHash(page, gateLabel);
  await openMode(page, baseUrl, 'hardware', gateLabel);
  await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });
}

export async function getRect(page, selector) {
  return page.evaluate((candidateSelector) => {
    const element = document.querySelector(candidateSelector);
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const visibleWidth = Math.max(0, Math.min(window.innerWidth, bounds.right) - Math.max(0, bounds.left));
    const visibleHeight = Math.max(0, Math.min(window.innerHeight, bounds.bottom) - Math.max(0, bounds.top));
    return {
      selector: candidateSelector,
      visible:
        bounds.width > 1 &&
        bounds.height > 1 &&
        visibleWidth > 1 &&
        visibleHeight > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden',
      top: Math.round(bounds.top),
      left: Math.round(bounds.left),
      right: Math.round(bounds.right),
      bottom: Math.round(bounds.bottom),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      visibleWidth: Math.round(visibleWidth),
      visibleHeight: Math.round(visibleHeight),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    };
  }, selector);
}

export async function getRequiredRect(page, selector, label) {
  const rect = await getRect(page, selector);
  assert(rect?.visible, `${label}: ${selector} is not visible`);
  return rect;
}

export async function getDockClipping(page, rootSelector, candidateSelectors) {
  return page.evaluate(
    ({ rootSelector: rootSel, candidateSelectors: candidateSels }) => {
      const root = document.querySelector(rootSel);
      if (!root) return { root: null, clipped: [] };
      const rootRect = root.getBoundingClientRect();
      const candidates = [...root.querySelectorAll(candidateSels.join(','))];
      const clipped = [];
      for (const element of candidates) {
        const bounds = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (bounds.width <= 1 || bounds.height <= 1 || style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }
        const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        const verticallyVisibleWithinRoot = bounds.bottom > rootRect.top + 1 && bounds.top < rootRect.bottom - 1;
        const outsideDock =
          verticallyVisibleWithinRoot &&
          (bounds.left < rootRect.left - 1 || bounds.right > rootRect.right + 1);
        const offViewport =
          verticallyVisibleWithinRoot &&
          (bounds.left < -1 || bounds.right > window.innerWidth + 1);
        const textOverflow = element.scrollWidth > element.clientWidth + 2;
        if (outsideDock || offViewport || textOverflow) {
          clipped.push({
            testId: element.getAttribute('data-testid'),
            tag: element.tagName,
            text,
            outsideDock,
            offViewport,
            textOverflow,
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          });
        }
      }
      return {
        root: {
          left: Math.round(rootRect.left),
          right: Math.round(rootRect.right),
          top: Math.round(rootRect.top),
          bottom: Math.round(rootRect.bottom),
          width: Math.round(rootRect.width),
          height: Math.round(rootRect.height),
        },
        clipped,
      };
    },
    { rootSelector, candidateSelectors }
  );
}

export function rectsOverlap(a, b) {
  if (!a || !b || !a.visible || !b.visible) return false;
  const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return horizontal > 1 && vertical > 1;
}

export async function assertReleaseReadinessClean(page, label) {
  await assertNoRootOverflow(page, label);
  const errorBoundaryVisible = await page
    .locator('[data-testid="ide-error-boundary"], text=/workspace encountered an error/i')
    .first()
    .isVisible()
    .catch(() => false);
  assert(!errorBoundaryVisible, `${label}: workspace error boundary is visible`);
}
