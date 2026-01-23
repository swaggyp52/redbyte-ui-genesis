
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.describe('Day 1 Lab Walkthrough', () => {
    test.slow();

    test('Instructor Script: Start -> Build -> Verify -> Export', async ({ page }) => {
        // 1. Boot to Desktop (Custom robust boot)
        for (let i = 0; i < 3; i++) {
            try {
                await page.goto('/', { waitUntil: 'domcontentloaded' });
                break;
            } catch (e) {
                console.log(`Navigation attempt ${i + 1} failed: ${e}`);
                if (i === 2) throw e;
                await page.waitForTimeout(1000);
            }
        }

        // Wait for Desktop
        await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible({ timeout: 30000 });

        // 2. Open Start Here -> Logic Playground (Manual Path)
        // This is robust against URL routing issues
        await page.getByText('Start Here').click();

        // Wait for Start Here app
        const startHere = page.locator('[data-testid="window-start-here"]');
        await expect(startHere).toBeVisible();

        // Click "Try Logic Playground" (or "Open Playground")
        // Based on StartHereApp.tsx: <div className={styles.cardAction}>Open Playground</div>
        await page.getByText('Open Playground').click();

        // Wait for Logic Playground
        await expect(page.locator('[data-testid="top-command-bar"]')).toBeVisible({ timeout: 15000 });

        // Verify "Day 1" elements
        await expect(page.getByText('Project')).toBeVisible();

        // 3. Build: Check Export/Open buttons
        const exportBtn = page.locator('[data-testid="export-evidence-button"]');
        await expect(exportBtn).toBeVisible();

        const openBtn = page.locator('[data-testid="open-evidence-button"]');
        await expect(openBtn).toBeVisible();

        // 4. Export: Click the button and verify download
        const downloadPromise = page.waitForEvent('download');
        await exportBtn.click();
        const download = await downloadPromise;

        // Verify Filename
        expect(download.suggestedFilename()).toContain('lab-evidence-');
        expect(download.suggestedFilename()).endsWith('.json');

        // Save and Inspect Content
        const path = await download.path();
        const content = fs.readFileSync(path, 'utf-8');
        const json = JSON.parse(content);

        // Verify JSON Structure
        expect(json.integrity).toBeDefined();
        expect(json.integrity.integrityHash).toBeDefined();

        // Bonus: Validate that probes/snapshots are present (even if empty)
        expect(json.circuitSnapshot).toBeDefined();
    });
});
