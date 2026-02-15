
import { Page, expect } from '@playwright/test';

export async function osReady(page: Page) {
    // 1. Navigate to the OS surface (base path is /os/)
    await page.goto('/os/', { waitUntil: 'domcontentloaded' });

    // 2. Wait for boot screen to be hidden (if it appears)
    const bootScreen = page.locator('[data-testid="shell-boot-screen"]');
    // We use a short timeout for the initial visibility check, but a long one for waiting for it to hide
    // if it is indeed present.
    if (await bootScreen.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(bootScreen).toBeHidden({ timeout: 60_000 });
    }

    // 3. Wait for stable desktop container
    await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible({ timeout: 60_000 });

    // 4. Wait for Logic Playground icon (interactive)
    await expect(page.locator('[data-testid="desktop-icon-logic-playground"]')).toBeVisible({ timeout: 60_000 });
}
