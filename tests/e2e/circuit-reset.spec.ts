import { test, expect } from '@playwright/test';
import { osReady } from './_helpers/osReady';

test.describe('Circuit Reset Semantics', () => {
    test.slow(); // Allow extra time for boot

    test.beforeEach(async ({ page }) => {
        // Boot RedByte OS
        await osReady(page);

        // Open Logic Playground
        await page.locator('[data-testid="desktop-icon-logic-playground"]').click();
        await expect(page.locator('[data-testid="logic-playground-root"]')).toBeVisible({ timeout: 60000 });

        // Wait for stability
        await page.waitForTimeout(1000);
    });

    test('New Project: Clean state should not prompt', async ({ page }) => {
        // Action: click New Project (by title)
        // Expect: No dialog (auto-accepted by Playwright if not handled? No, Playwright defaults to dismiss if event listener not attached. But if no dialog appears, listener won't fire)

        let dialogFired = false;
        page.on('dialog', async dialog => {
            dialogFired = true;
            await dialog.dismiss();
        });

        await page.getByTitle('New Project').click();

        // Give it a moment to potentially fire
        await page.waitForTimeout(500);
        expect(dialogFired).toBe(false);
    });

    test('New Project: Dirty state should prompt', async ({ page }) => {
        // Make dirty by adding a component (e.g. Lamp from palette)
        // Palette button id: "palette-lamp" (guessed from smoke test)
        // Actually smoke test said 'palette-lamp'
        const lampBtn = page.locator('[data-testid="palette-lamp"]');
        await expect(lampBtn).toBeVisible();
        await lampBtn.click();

        // Click on canvas to place it
        const canvas = page.locator('canvas').first();
        await canvas.click({ position: { x: 300, y: 300 } });

        // Check dirty via window title or just assume adding component makes it dirty.
        // Wait a bit for state update
        await page.waitForTimeout(500);

        // Expect Dialog on New Project
        let dialogMessage = '';
        const dialogPromise = page.waitForEvent('dialog');
        await page.getByTitle('New Project').click();
        const dialog = await dialogPromise;

        dialogMessage = dialog.message();
        expect(dialogMessage).toContain('You have unsaved changes');
        await dialog.dismiss(); // CANCEL

        // Verify circuit NOT cleared (still has nodes)
        const nodeCount = await page.evaluate(() => window.__RB_CIRCUIT_STORE__.getState().circuit.nodes.length);
        expect(nodeCount).toBeGreaterThan(0);

        // Try again and ACCEPT
        const dialogPromise2 = page.waitForEvent('dialog');
        await page.getByTitle('New Project').click();
        const dialog2 = await dialogPromise2;
        await dialog2.accept();

        // Verify circuit IS cleared
        // Wait for React state update
        await page.waitForTimeout(500);
        const nodeCountAfter = await page.evaluate(() => window.__RB_CIRCUIT_STORE__.getState().circuit.nodes.length);
        expect(nodeCountAfter).toBe(0);
    });

    test('Load Example: Dirty state should prompt', async ({ page }) => {
        // Make dirty
        const lampBtn = page.locator('[data-testid="palette-lamp"]');
        await lampBtn.click();
        const canvas = page.locator('canvas').first();
        await canvas.click({ position: { x: 300, y: 300 } });
        await page.waitForTimeout(500);

        // Open Examples Gallery
        await page.getByTestId('logic-playground-examples').click();

        // Select an example (e.g., "Wire + Lamp" or similar)
        // Gallery renders buttons with titles.
        // We'll click the first example in the list, or specific one.
        // Let's assume there's at least one button in the gallery list.
        const firstExample = page.locator('.grid button').first();

        // Expect Dialog when clicking example
        const dialogPromise = page.waitForEvent('dialog');
        await firstExample.click();
        const dialog = await dialogPromise;

        expect(dialog.message()).toContain('Loading an example will discard them');
        await dialog.dismiss(); // Cancel

        // Verify not loaded (node count should be 1 from our lamp)
        // (Assuming example has != 1 nodes, or we check content)
        const nodeCount = await page.evaluate(() => window.__RB_CIRCUIT_STORE__.getState().circuit.nodes.length);
        expect(nodeCount).toBe(1);

        // Try again and Accept
        await page.getByTestId('logic-playground-examples').click(); // Re-open modal if closed (Cancel usually closes modal? No, confirmReplacement returns false, so handleLoadExample returns early. Modal stays open? No, handleLoadExample closes modal? 
        // LogicPlaygroundApp.tsx: 
        // <ExampleGalleryModal ... onSelectExample={handleLoadExample} ... />
        // Wait, LogicPlaygroundApp passes `example` to `handleLoadExample`. 
        // `ExampleGalleryModal` calls `onSelectExample(example); onClose();`
        // So modal closes BEFORE `handleLoadExample` runs? 
        // Let's check `ExampleGalleryModal.tsx`:
        // onClick={() => { onSelectExample(example); onClose(); }}
        // So modal closes. Then `handleLoadExample` runs. Then `confirmReplacement` triggers dialog.
        // If canceled, modal is already closed.

        // So we need to re-open modal to try again? No, we clicked the button in the modal.
        // If we dismissed dialog, the action aborted. Modal likely closed.
        // So we need to re-open gallery to try again.
        await page.getByTestId('logic-playground-examples').click();

        const firstExample2 = page.locator('.grid button').first();
        const dialogPromise2 = page.waitForEvent('dialog');
        await firstExample2.click();
        const dialog2 = await dialogPromise2;
        await dialog2.accept();

        // Verify loaded
        await page.waitForTimeout(1000);
        const nodeCountAfter = await page.evaluate(() => window.__RB_CIRCUIT_STORE__.getState().circuit.nodes.length);
        // Example "Wire + Lamp" likely has 2 nodes. If random example, likely > 1.
        // Or at least different than 1 if it's not just a single lamp.
        // Let's just check it changed or is > 1.
        expect(nodeCountAfter).not.toBe(1);
    });
});
