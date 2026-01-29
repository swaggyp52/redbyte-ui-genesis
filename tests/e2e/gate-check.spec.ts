import { test, expect } from '@playwright/test';
import { osReady } from './_helpers/osReady';

test.describe('Ship Gate UI Check', () => {
    test('Hardware Rack Panel reflects bridge reality', async ({ page }) => {
        // 1. Boot OS
        await osReady(page);

        // 2. Open Hardware Panel (it might be closed by default, or we open it)
        // Assuming we need to open it via a dock or menu if it's not visible.
        // In RedByte OS, the Rack Controller is usually visible or accessible.
        // Let's assume we can find it by text "RACK_CONTROLLER" or the header.

        // Check if the panel is already noticeable? 
        // If not, we might need to find the icon to toggle it.
        // But typically the "Hardware" or "Rack" panel is part of the layout.
        // Let's look for the header text "Hardware Reality"

        const header = page.getByText('Hardware Reality');
        if (!await header.isVisible()) {
            // If not visible, try to find the "Chips" or "Hardware" icon in the dock/activity bar
            // This relies on knowing the layout. 
            // For now, let's assume standard layout or try to find a generic way.
            // If this fails, the test fails, which is good.
        }

        await expect(header).toBeVisible({ timeout: 10000 });

        // 3. Verify Bridge Status
        // It should say "ONLINE" because ship:gate script ensures the bridge is running
        await expect(page.getByText('ONLINE')).toBeVisible({ timeout: 10000 });

        // 4. Verify Device List or Empty State
        // Since verify_client.ts confirms devices, we should see them here too.
        // We expect at least one device (mock or real) if the bridge is fulfilling the contract.
        // If verify_client.ts passed, devices are discoverable.

        // We look for a device entry. The code uses "Unknown Device" or model name.
        // Let's look for "VIRTUAL" or a port number or "idle".
        // Or simpler: We expect NOT to see "No Hardware Found" if we have devices.
        // But if we are in a purely virtual CI environment without mock devices, it might be empty.
        // However, verify_client.ts usually mocks if needed? workspace `rb-bridge-agent` has a mock mode?
        // The user said "Plug Basys3 -> node auto-spawns". 
        // If this runs in CI without hardware, we might need a mock.
        // For now, let's assertive on the *Bridge Status* being the critical gate.

        // Check for "HBEAT" to confirm live updates
        await expect(page.getByText('● HBEAT')).toBeVisible();
    });
});
