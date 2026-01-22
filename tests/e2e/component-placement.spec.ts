import { test, expect } from '@playwright/test';

test.describe('Component Placement', () => {
    test('drag-and-drop updates footer count', async ({ page }) => {
        // Navigate using baseURL from config
        await page.goto('/');

        // Open Logic Playground
        await page.getByText('Logic Playground').click();

        // Wait for canvas to be ready
        await page.waitForSelector('[data-testid="logic-canvas"]', { timeout: 15000 });

        // Verify initial state using the test ID
        const nodeCountElement = page.getByTestId('status-node-count');
        await expect(nodeCountElement).toContainText('0 node', { timeout: 10000 });

        // Find Switch component using data-component-type
        const switchComponent = page.locator('[data-component-type="Switch"]').first();
        await expect(switchComponent).toBeVisible({ timeout: 10000 });

        // Get canvas for drop target
        const canvas = page.locator('[data-testid="logic-canvas"]');
        await expect(canvas).toBeVisible();

        // Manual HTML5 drag-and-drop with proper dataTransfer setup
        await page.evaluate(async ({ sourceSelector, targetSelector, componentType }) => {
            const source = document.querySelector(sourceSelector) as HTMLElement;
            const target = document.querySelector(targetSelector) as HTMLElement;

            if (!source || !target) {
                throw new Error(`Source or target not found: ${sourceSelector}, ${targetSelector}`);
            }

            // Create DataTransfer and set the MIME type that the app expects
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('application/x-redbyte-node-type', componentType);
            dataTransfer.effectAllowed = 'copy';

            // Dispatch dragstart on source
            const dragStartEvent = new DragEvent('dragstart', {
                bubbles: true,
                cancelable: true,
                dataTransfer
            });
            source.dispatchEvent(dragStartEvent);

            // Get target bounds for drop position
            const targetRect = target.getBoundingClientRect();
            const dropX = targetRect.left + targetRect.width / 2;
            const dropY = targetRect.top + targetRect.height / 2;

            // Dispatch dragover on target
            const dragOverEvent = new DragEvent('dragover', {
                bubbles: true,
                cancelable: true,
                clientX: dropX,
                clientY: dropY,
                dataTransfer
            });
            target.dispatchEvent(dragOverEvent);

            // Dispatch drop on target
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                clientX: dropX,
                clientY: dropY,
                dataTransfer
            });
            target.dispatchEvent(dropEvent);

            // Dispatch dragend on source
            const dragEndEvent = new DragEvent('dragend', {
                bubbles: true,
                cancelable: true,
                dataTransfer
            });
            source.dispatchEvent(dragEndEvent);
        }, {
            sourceSelector: '[data-component-type="Switch"]',
            targetSelector: '[data-testid="logic-canvas"]',
            componentType: 'Switch'
        });

        // Wait for state propagation and verify footer updated
        await expect(nodeCountElement).toContainText('1 node', { timeout: 15000 });

        // Verify old count is gone
        await expect(nodeCountElement).not.toContainText('0 node');
    });

    test('multiple components increment count correctly', async ({ page }) => {
        await page.goto('/');
        await page.getByText('Logic Playground').click();
        await page.waitForSelector('[data-testid="logic-canvas"]', { timeout: 15000 });

        const nodeCountElement = page.getByTestId('status-node-count');

        // Add first component (Switch)
        await page.evaluate(async ({ sourceSelector, targetSelector, componentType }) => {
            const source = document.querySelector(sourceSelector) as HTMLElement;
            const target = document.querySelector(targetSelector) as HTMLElement;
            if (!source || !target) throw new Error('Elements not found');

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('application/x-redbyte-node-type', componentType);
            dataTransfer.effectAllowed = 'copy';

            source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));

            const targetRect = target.getBoundingClientRect();
            const dropX = targetRect.left + 200;
            const dropY = targetRect.top + 200;

            target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: dropX, clientY: dropY, dataTransfer }));
            target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: dropX, clientY: dropY, dataTransfer }));
            source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
        }, {
            sourceSelector: '[data-component-type="Switch"]',
            targetSelector: '[data-testid="logic-canvas"]',
            componentType: 'Switch'
        });

        await expect(nodeCountElement).toContainText('1 node', { timeout: 15000 });

        // Add second component (Lamp)
        await page.evaluate(async ({ sourceSelector, targetSelector, componentType }) => {
            const source = document.querySelector(sourceSelector) as HTMLElement;
            const target = document.querySelector(targetSelector) as HTMLElement;
            if (!source || !target) throw new Error('Elements not found');

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('application/x-redbyte-node-type', componentType);
            dataTransfer.effectAllowed = 'copy';

            source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));

            const targetRect = target.getBoundingClientRect();
            const dropX = targetRect.left + 400;
            const dropY = targetRect.top + 200;

            target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: dropX, clientY: dropY, dataTransfer }));
            target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: dropX, clientY: dropY, dataTransfer }));
            source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
        }, {
            sourceSelector: '[data-component-type="Lamp"]',
            targetSelector: '[data-testid="logic-canvas"]',
            componentType: 'Lamp'
        });

        await expect(nodeCountElement).toContainText('2 nodes', { timeout: 15000 });
    });
});
