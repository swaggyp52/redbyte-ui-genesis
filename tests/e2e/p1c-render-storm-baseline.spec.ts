import { test, expect } from '@playwright/test';
import { createFailureWatcher } from './helpers';

const EXTRA_FLAGS = process.env.E2E_FLAGS || '';
const OS_URL = `/os/?ce=1${EXTRA_FLAGS ? `&${EXTRA_FLAGS}` : ''}`;
const BASELINE_FLAGS = 'e2e=1&cpuLite=1&disableQuad=1&disableSplitView=1';

function attachRenderStormFailFast(page: any) {
  let disposed = false;
  let warnHandler: ((msg: any) => void) | null = null;

  const stormPromise: Promise<never> = new Promise((_, reject) => {
    warnHandler = (msg: any) => {
      if (disposed) return;
      if (msg.type() !== 'warning') return;
      const text = msg.text();
      if (!text.includes('[render-storm]')) return;
      disposed = true;
      reject(new Error(`Render storm detected: ${text}`));
    };
    page.on('console', warnHandler);
  });

  const topReportPromise: Promise<void> = new Promise((resolve) => {
    const handler = (msg: any) => {
      if (msg.type() !== 'log') return;
      const text = msg.text();
      if (!text.includes('[render-storm:top]')) return;
      page.off('console', handler);
      resolve();
    };
    page.on('console', handler);
  });

  const dispose = () => {
    disposed = true;
    if (warnHandler) page.off('console', warnHandler);
  };

  return { stormPromise, topReportPromise, dispose };
}

test.describe('P1C Render Storm Baseline', () => {
  test.describe.configure({ timeout: 90_000 });

  test('Logic Playground: idle + short run has no render-storm warnings', async ({ page }) => {
    // Enable render-storm offender reporting (enabled in Playwright runs).
    await page.addInitScript(() => {
      try {
        // Skip boot screen so automation can reach app surfaces deterministically.
        localStorage.setItem('rb:shell:booted:v1', '1');
        localStorage.setItem('rb:renderStormReport', '1');
      } catch {}
    });

    const { failPromise, dispose: disposeWatcher } = createFailureWatcher(page, 'http://127.0.0.1:4173');
    const { stormPromise, topReportPromise, dispose: disposeStorm } = attachRenderStormFailFast(page);

    try {
      await page.goto(`${OS_URL}&openApp=logic-playground&${BASELINE_FLAGS}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      // Fail fast if Shell never mounts (boot-time crash/hang).
      const bootOkConsole = page.waitForEvent(
        'console',
        (msg) => msg.type() === 'info' && msg.text().includes('RB_BOOT_OK'),
        { timeout: 15_000 }
      );
      await Promise.race([
        failPromise,
        bootOkConsole,
      ]);

      const root = page.locator('[data-testid="logic-playground-root"]');
      await expect(root).toBeVisible({ timeout: 30_000 });

      // Watchdog gates on data-ready="true"
      await expect(root).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });

      // Ensure the top-offenders reporter is actually producing output.
      await Promise.race([topReportPromise, stormPromise, failPromise, page.waitForTimeout(5_000)]);

      // Idle settle window
      await Promise.race([stormPromise, failPromise, page.waitForTimeout(3_000)]);

      // Short sim run (if the control exists in this mode)
      const runBtn = page.locator('[data-testid="logic-playground-run"]');
      if (await runBtn.isVisible().catch(() => false)) {
        await runBtn.click();
        await Promise.race([stormPromise, failPromise, page.waitForTimeout(2_000)]);
      }
    } finally {
      disposeStorm();
      disposeWatcher();
    }
  });
});
