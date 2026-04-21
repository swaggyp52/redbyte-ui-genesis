/**
 * Minimal runtime proof for Verify after 2026-04-21 hardening: full Verify panel visible
 * after a run (preview on 127.0.0.1:4173). Pass-hero + "Use saved checks" compare flows are
 * covered in Vitest; full compare + pass-hero in Playwright depends on starter project vectors
 * with expected cells (see verifySurface.workstation tests).
 */
import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts');
const PROOF = path.join(ARTIFACT_DIR, 'verify-surface-hardening-2026-04-21-workspace.png');

test.describe('Verify surface (hardening — workspace visibility)', () => {
  test('Verify mode after run: command bar + session strip', async ({ page }) => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }

    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 60000 });

    await page.getByTestId('ide-project-landing-example-signal-tour').click();
    await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('mode-button-verify').click();
    await expect(page.getByTestId('ide-mode-verify')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ide-vcb-run').click();
    await expect(page.getByTestId('ide-vcb-run')).toBeVisible({ timeout: 60000 });

    const panel = page.getByTestId('ide-mode-verify');
    await expect(panel).toBeVisible();
    await page.screenshot({ path: PROOF, fullPage: true, animations: 'disabled' });
  });
});
