import { test, expect } from '@playwright/test';

test.describe('redbyte os smoke', () => {
  test('boot to desktop and open terminal', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/redbyte os/i)).toBeVisible();

    await page.waitForTimeout(800);
    await expect(page.getByText(/boot/iu).first()).toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.getByRole('button', { name: /terminal/i })).toBeVisible();
    await page.getByRole('button', { name: /terminal/i }).click();

    const terminalWindow = page.getByText(/Genesis Terminal/i);
    await expect(terminalWindow).toBeVisible();

    const input = page.getByRole('textbox').last();
    await input.click();
    await input.fill('help');
    await input.press('Enter');

    await expect(page.getByText(/available commands/i)).toBeVisible();
  });
});
