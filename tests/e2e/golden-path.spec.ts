import { test, expect } from '@playwright/test';

test.describe('Logic Playground Golden Path', () => {
    test('should boot, open Half Adder, and toggle simulation', async ({ page }) => {
        // 1. Boot to OS
        await page.goto('http://localhost:5175/');
        await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible({ timeout: 20000 });

        // 2. Clear any persistent modals (Welcome, Onboarding)
        const modals = page.locator('button:has-text("Close"), button:has-text("Get Started"), [data-testid="window-close-button"]');
        const count = await modals.count();
        for (let i = 0; i < count; i++) {
            if (await modals.nth(i).isVisible()) {
                await modals.nth(i).click();
                await page.waitForTimeout(500);
            }
        }

        // 3. Open Logic Playground from Dock
        const lpIcon = page.locator('[data-testid="dock-icon-logic-playground"]');
        await expect(lpIcon).toBeVisible({ timeout: 15000 });
        await lpIcon.click();
        await expect(page.locator('[data-testid="top-command-bar"]')).toBeVisible({ timeout: 10000 });

        // 4. Open Examples and select Half Adder
        await page.locator('[data-testid="logic-playground-examples"]').click();

        // Assuming the example is at least visible by text
        const halfAdderOption = page.locator('button:has-text("Half Adder"), div:has-text("Half Adder")').first();
        await expect(halfAdderOption).toBeVisible({ timeout: 5000 });
        await halfAdderOption.click();

        // 5. Verify nodes are loaded
        await expect(page.locator('[data-testid="node-Switch-a_in"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="node-Lamp-sum_lamp"]')).toBeVisible({ timeout: 5000 });

        // 6. Toggle simulation - Switch a_in (Half Adder: A=1, B=0 -> Sum=1, Carry=0)
        const switchA = page.locator('[data-testid="switch-toggle-a_in"]');
        await switchA.click();

        // 7. Verify Lamp state (Sum should be ON)
        // Active color for Lamp is #fbbf24.
        const sumLamp = page.locator('[data-testid="node-Lamp-sum_lamp"] rect').first();
        await expect(sumLamp).toHaveAttribute('fill', '#fbbf24', { timeout: 5000 });

        // 8. Toggle Switch b_in (Half Adder: A=1, B=1 -> Sum=0, Carry=1)
        const switchB = page.locator('[data-testid="switch-toggle-b_in"]');
        await switchB.click();

        // Sum should be OFF (#2a2a2a)
        await expect(sumLamp).toHaveAttribute('fill', '#2a2a2a', { timeout: 5000 });

        // Carry should be ON (#fbbf24)
        const carryLamp = page.locator('[data-testid="node-Lamp-carry_lamp"] rect').first();
        await expect(carryLamp).toHaveAttribute('fill', '#fbbf24', { timeout: 5000 });

        console.log('Golden Path Smoke Test: PASSED');
    });
});
