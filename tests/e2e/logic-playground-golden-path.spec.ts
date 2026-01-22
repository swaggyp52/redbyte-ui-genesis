
import { test, expect } from '@playwright/test';
import { osReady } from './_helpers/osReady';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Student Lab & Submission Inspector Golden Path', () => {
    test.slow();

    test('Complete Lab Attempt -> Export -> Inspect Submission', async ({ page }) => {
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

        // Handle potential "about:blank" redirects or hydration contentions
        try {
            await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible({ timeout: 10000 });
        } catch {
            console.log('Desktop not visible, reloading...');
            await page.reload({ waitUntil: 'networkidle' });
        }

        // Wait for boot screen to clear
        const bootScreen = page.locator('[data-testid="shell-boot-screen"]');
        if (await bootScreen.isVisible().catch(() => false)) {
            await expect(bootScreen).toBeHidden({ timeout: 30000 });
        }
        await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible({ timeout: 30000 });
        await page.getByText('Lab Workbench').click();
        const labWindow = page.locator('[data-testid="window-student-lab"]');
        // Note: Window ID might be different, but typically it wraps the content.
        // Actually StudentLabApp doesn't set a window test-id on the app root, but the WindowManager might.
        // Let's rely on text visibility.
        await expect(page.getByText('RedByte Logic Labs')).toBeVisible({ timeout: 10000 });

        // 3. Enter Identity
        const nameInput = page.getByPlaceholder('Enter your name');
        await nameInput.click();
        await nameInput.fill('Test Student');

        // 4. Select Lab (Traffic Light Controller)
        await page.getByText('Traffic Light Controller').click();

        // 5. Start Attempt
        await page.getByRole('button', { name: 'Start Attempt' }).click();
        await expect(page.getByText('Attempt in progress')).toBeVisible();

        // 6. Build Tab: Select Preset
        await page.getByRole('button', { name: '2. Build' }).click();
        // Wait for presets to load
        await expect(page.getByText('Select Your Implementation')).toBeVisible();

        // Select first preset if available
        // We need to handle case where no presets exist, but assuming there is one.
        // Click the first preset card
        const presetCard = page.locator('button[class*="presetCard"]').first();
        await expect(presetCard).toBeVisible({ timeout: 5000 });
        await presetCard.click();

        // 7. Self-Check Tab: Run Check
        await page.getByRole('button', { name: '4. Self-Check' }).click();
        await page.getByRole('button', { name: 'Run Self-Check' }).click();
        // Wait for results
        await expect(page.getByText('passed', { exact: false })).toBeVisible();

        // 8. Export Tab
        await page.getByRole('button', { name: '5. Export' }).click();

        // Handle Download
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export .rb-lab.zip' }).click();
        await page.getByRole('button', { name: 'Confirm Export' }).click();
        const download = await downloadPromise;

        // Verify Filename
        expect(download.suggestedFilename()).toContain('traffic-light');
        expect(download.suggestedFilename()).toContain('rb-lab.zip');

        // Save to temp
        const downloadPath = await download.path();

        // Verify Zip Content
        const zipData = fs.readFileSync(downloadPath);
        const zip = await JSZip.loadAsync(zipData);
        expect(zip.file('manifest.json')).toBeTruthy();
        const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
        expect(manifest.lab_id).toBe('traffic-light');
        expect(manifest.student.name).toBe('Test Student');

        // 9. Close Workbench (optional, just open Inspector)
        // Locate close button of the window? 
        // Or just open Inspector.

        // 10. Open Submission Inspector
        await page.getByText('Submission Inspector').click();
        await expect(page.getByRole('heading', { name: 'Submission Inspector' })).toBeVisible();

        // 11. Upload Submission
        // The Inspector has a file input. We need to attach the file to it.
        // The input is hidden: <input type="file" ... style={{ display: 'none' }} />
        // We can locate it by label or just by type=file
        const fileInput = page.locator('input[type="file"][accept=".rb-lab.zip"]');
        await fileInput.setInputFiles(downloadPath);

        // 12. Verify Inspector Display
        await expect(page.getByText('Submission Summary')).toBeVisible();
        await expect(page.getByText('Traffic Light Controller', { exact: false })).toBeVisible();
        await expect(page.getByText('Test Student')).toBeVisible();
        await expect(page.getByText('PASS')).toBeVisible();
    });
});
