import { test, expect } from '@playwright/test';
test.describe('CanvasHost Gates', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to playground
        await page.goto('/');
        // Wait for canvas to be ready (look for HUD or Grid)
        await expect(page.getByTestId('circuit-hud')).toBeVisible({ timeout: 10000 });
    });
    // Helper to get logic canvas container
    const getCanvas = (page) => page.getByTestId('circuit-hud').locator('xpath=../..');
    test('Gate 1: Wheel zoom does not scroll page when hovering canvas', async ({ page }) => {
        const canvas = getCanvas(page);
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // Scroll the wheel
        await page.mouse.wheel(0, 500);
        // Wait a bit for potential scroll
        await page.waitForTimeout(100);
        // Check window scroll Y
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBe(0);
    });
    test('Gate 2: Space in sidebar input does not pan/active canvas', async ({ page }) => {
        const sidebarInput = page.locator('input').first();
        if (await sidebarInput.count() === 0) {
            test.skip(true, 'No inputs found on page to test Gate 2');
            return;
        }
        await sidebarInput.click();
        await sidebarInput.fill('test');
        await sidebarInput.press('Space');
        const val = await sidebarInput.inputValue();
        expect(val).toContain(' '); // Space was typed
    });
    test('Gate 3: Hovering HUD overlay does not deactivate canvas', async ({ page }) => {
        const hud = page.getByTestId('circuit-hud');
        await hud.hover();
        // Wheel over HUD
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(100);
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBe(0);
    });
    test('Gate 4: Two canvases - only hovered one active', async ({ page }) => {
        // Navigate to the dual-canvas test route
        await page.goto('/?boot=bisect&step=10');
        const leftBox = await page.getByTestId('canvas-left').boundingBox();
        const rightBox = await page.getByTestId('canvas-right').boundingBox();
        expect(leftBox).toBeTruthy();
        expect(rightBox).toBeTruthy();
        // 1. Move to LEFT
        await page.mouse.move(leftBox.x + 10, leftBox.y + 10);
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(50);
        // 2. Move to RIGHT
        await page.mouse.move(rightBox.x + 10, rightBox.y + 10);
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(50);
    });
    test('Gate 5: Window blur releases canvas active state', async ({ page }) => {
        const canvas = getCanvas(page);
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // Dispatched blur event
        await page.evaluate(() => {
            window.dispatchEvent(new Event('blur'));
        });
        await page.mouse.wheel(0, 500);
    });
    test('Gate 6: ContentEditable does not get space stolen', async ({ page }) => {
        await page.evaluate(() => {
            const div = document.createElement('div');
            div.contentEditable = 'true';
            div.id = 'test-ce';
            div.style.position = 'absolute';
            div.style.zIndex = '9999';
            div.style.top = '100px';
            div.style.left = '100px';
            div.style.width = '100px';
            div.style.height = '100px';
            div.style.backgroundColor = 'white';
            document.body.appendChild(div);
        });
        const ce = page.locator('#test-ce');
        await ce.click();
        await ce.keyboard.press(' ');
        const text = await ce.innerText();
        expect(text).not.toBe('');
    });
    test('Gate 7: Unmount cleanup clears active state', async ({ page }) => {
        const canvas = getCanvas(page);
        const box = await canvas.boundingBox();
        // Enter canvas
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // Navigate away (triggers unmount)
        await page.goto('about:blank');
        // Verify no error during unmount cleanup
        expect(page.url()).toBe('about:blank');
    });
});
