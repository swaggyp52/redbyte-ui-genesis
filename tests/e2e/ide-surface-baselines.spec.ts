/**
 * IDE Surface Baseline Gate
 *
 * DOM-landmark browser baseline for all 5 authority IDE surfaces at two viewport sizes.
 * Does NOT use pixel-diff (toHaveScreenshot). Screenshots are captured as test artifacts only.
 *
 * Purpose: Catch surface-level layout regressions before Hardware / Export density cleanup.
 *
 * Surfaces covered: Project, Design, Verify, Hardware, Export
 * Viewports: 1366Ã—768, 1920Ã—1080
 *
 * Pattern: follows board-clock-browser-proof.spec.ts conventions exactly.
 * - Suppresses onboarding via localStorage before navigation
 * - Loads the 2-bit counter example (stable, sequential, has CLK100MHZ)
 * - Navigates surfaces via mode-button testids
 * - Asserts stable high-level landmarks (not copy, not pixel)
 * - Saves screenshots to artifacts/surface-baselines/ and attaches to test report
 */

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts', 'surface-baselines');

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1920x1080', width: 1920, height: 1080 },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function suppressOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
}

/**
 * Load the 2-bit counter example and wait for Design surface to confirm load.
 * Mirrors the exact pattern in board-clock-browser-proof.spec.ts.
 */
async function loadTwoBitCounter(page: Page): Promise<void> {
  const assertProjectHomeVisible = async (url: string) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 60000 });
    await expect(page.getByTestId('ide-mode-project')).toBeVisible({ timeout: 15000 });

    const hasLanding = await page.getByTestId('ide-project-landing').isVisible().catch(() => false);
    const hasPanel = await page.getByTestId('ide-project-panel').isVisible().catch(() => false);
    expect(
      hasLanding || hasPanel,
      `Project surface should render meaningful first-load content for ${url}`
    ).toBe(true);
    await expect(page.getByTestId('mode-button-project')).toHaveAttribute('data-active', 'true');
  };

  await assertProjectHomeVisible('/?e2e=1');
  await assertProjectHomeVisible('/os/?e2e=1');

  await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 60000 });
  await page.getByTestId('ide-project-landing-example-two-bit-counter').click();
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30000 });
}

/**
 * Assert no horizontal page overflow.
 * Horizontal overflow causes surfaces to be partially hidden at smaller viewports.
 */
async function assertNoHorizontalOverflow(page: Page, surface: string): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasOverflow, `Unexpected horizontal overflow on ${surface} surface`).toBe(false);
}

/**
 * Capture a screenshot as a test artifact.
 * Screenshots are NOT committed to git; they appear in the Playwright HTML report.
 */
async function captureArtifact(
  page: Page,
  name: string,
  testInfo: TestInfo
): Promise<void> {
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });
  const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  await testInfo.attach(name, { path: filePath, contentType: 'image/png' });
}

// ---------------------------------------------------------------------------
// Gate: one describe per viewport
// ---------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  test.describe(`IDE surface baselines â€” ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(
      `all 5 surfaces render coherent landmarks at ${vp.label}`,
      async ({ page }, testInfo) => {
        // ----------------------------------------------------------------
        // Boot: suppress onboarding and load the 2-bit counter example
        // ----------------------------------------------------------------
        await suppressOnboarding(page);
        await loadTwoBitCounter(page);

        // After loading the counter we land on Design.
        // Walk surfaces: Design â†’ Verify â†’ Hardware â†’ Export â†’ Project

        // ----------------------------------------------------------------
        // DESIGN surface
        // ----------------------------------------------------------------
        // Already on Design after loading counter; confirm before asserting.
        await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 15000 });

        // Workbench canvas and toolbar must be present at both viewports
        await expect(page.getByTestId('ide-design-canvas')).toBeVisible();
        await expect(page.getByTestId('ide-design-toolbar')).toBeVisible();

        await assertNoHorizontalOverflow(page, 'Design');
        await captureArtifact(page, `design-${vp.label}`, testInfo);

        // ----------------------------------------------------------------
        // VERIFY surface
        // ----------------------------------------------------------------
        await page.getByTestId('mode-button-verify').click();
        await expect(page.getByTestId('ide-mode-verify')).toBeVisible({ timeout: 15000 });

        // Board-clock auto mode must be present (CLK100MHZ/W5 is pre-mapped on 2-bit counter)
        await expect(page.getByTestId('ide-verify-clock-policy-panel')).toBeVisible();
        await expect(page.getByTestId('ide-verify-board-clock-source')).toContainText('CLK100MHZ');
        await expect(page.getByTestId('ide-verify-clock-mode-summary')).toContainText(
          'Auto board clock'
        );

        // Stimulus authoring header (added in ScenarioBuilder clarity pass 826a4f92)
        await expect(page.getByTestId('ide-verify-stimulus-header')).toBeVisible();

        // No manual CLK row in auto mode
        await expect(page.getByTestId('ide-stimulus-clock-row')).toHaveCount(0);

        await assertNoHorizontalOverflow(page, 'Verify');
        await captureArtifact(page, `verify-${vp.label}`, testInfo);

        // ----------------------------------------------------------------
        // HARDWARE / Map Pins surface
        // ----------------------------------------------------------------
        await page.getByTestId('mode-button-hardware').click();
        await expect(page.getByTestId('ide-mode-hardware')).toBeVisible({ timeout: 15000 });

        // Main workflow ribbon â€” always rendered on Hardware surface
        await expect(page.getByTestId('ide-hw-workflow-ribbon')).toBeVisible();

        // Dep-chain is the primary content area within the ribbon
        await expect(page.getByTestId('ide-hardware-dep-chain')).toBeVisible();

        // Optionally activate Map mode to reach the board workspace
        const mapModeBtn = page.getByTestId('ide-hw-mode-btn-map');
        if (await mapModeBtn.isVisible().catch(() => false)) {
          await mapModeBtn.click();
          await expect(page.getByTestId('ide-hw-board-workspace')).toBeVisible({ timeout: 10000 });
          await expect(page.getByTestId('ide-hw-map-table')).toBeVisible();
        }

        await assertNoHorizontalOverflow(page, 'Hardware');
        await captureArtifact(page, `hardware-${vp.label}`, testInfo);

        // ----------------------------------------------------------------
        // EXPORT surface
        // ----------------------------------------------------------------
        await page.getByTestId('mode-button-export').click();
        await expect(page.getByTestId('ide-mode-export')).toBeVisible({ timeout: 15000 });

        // Build-output section must be present
        // Note: ide-export-readiness-details is in the DOM but CSS-hidden in the default state
        // when no explicit export build has been triggered â€” this is current product behavior.
        await expect(page.getByTestId('ide-export-build-output')).toBeVisible();

        await assertNoHorizontalOverflow(page, 'Export');
        await captureArtifact(page, `export-${vp.label}`, testInfo);

        // ----------------------------------------------------------------
        // PROJECT surface (navigate back after project is already loaded)
        // ----------------------------------------------------------------
        await page.getByTestId('mode-button-project').click();
        await expect(page.getByTestId('ide-mode-project')).toBeVisible({ timeout: 15000 });

        // Map-pins header is proven stable in ide-mapping-pipeline-coherence.spec.ts
        // when navigating back to Project with a loaded project
        await expect(page.getByTestId('ide-project-map-pins-header')).toBeVisible({
          timeout: 10000,
        });

        await assertNoHorizontalOverflow(page, 'Project');
        await captureArtifact(page, `project-${vp.label}`, testInfo);
      }
    );
  });
}
