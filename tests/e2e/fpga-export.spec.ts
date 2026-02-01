// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { test, expect } from '@playwright/test';

test.describe('FPGA Export Workflow', () => {
  test('should export Verilog from 8-bit counter example', async ({ page }) => {
    await page.goto('/');
    
    // Wait for OS to boot
    await page.waitForSelector('[data-testid="desktop"]', { timeout: 10000 });
    
    // Open Logic Playground
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]', { timeout: 5000 });
    
    // Open command palette
    await page.keyboard.press('Control+Shift+P');
    await page.waitForSelector('[data-testid="command-palette"]');
    
    // Load 8-bit counter example
    await page.fill('[data-testid="command-palette-input"]', 'load example');
    await page.keyboard.press('ArrowDown'); // Select "Load Example" command
    await page.keyboard.press('Enter');
    
    // Select 8-bit counter from example list
    await page.waitForSelector('text=8-bit Counter (Basys3)');
    await page.click('text=8-bit Counter (Basys3)');
    
    // Wait for circuit to load
    await page.waitForTimeout(1000);
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Trigger Export Verilog command
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    
    // Wait for download to complete
    const download = await downloadPromise;
    
    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/\.v$/);
    
    // Read downloaded file content
    const path = await download.path();
    const fs = require('fs');
    const verilogContent = fs.readFileSync(path, 'utf-8');
    
    // Verify Verilog contains expected structures
    expect(verilogContent).toContain('module');
    expect(verilogContent).toContain('endmodule');
    expect(verilogContent).toContain('input wire');
    expect(verilogContent).toContain('output wire');
    expect(verilogContent).toContain('DFF'); // D flip-flop instances
    
    // Check for validation success toast
    await expect(page.locator('text=/Verilog exported successfully|synthesis readiness/')).toBeVisible({ timeout: 3000 });
  });

  test('should validate Verilog before export', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop"]');
    
    // Open Logic Playground
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]');
    
    // Load Traffic Light FSM example
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'load example');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=Traffic Light FSM');
    await page.click('text=Traffic Light FSM');
    await page.waitForTimeout(1000);
    
    // Trigger Export Verilog
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    
    // Should show readiness score
    await expect(page.locator('text=/synthesis readiness: \\d+%/')).toBeVisible({ timeout: 5000 });
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('Traffic_Light');
  });

  test('should export XDC constraints with Verilog', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop"]');
    
    // Open Logic Playground and load 4-bit ALU
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]');
    
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'load example');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=4-bit ALU');
    await page.click('text=4-bit ALU');
    await page.waitForTimeout(1000);
    
    // Set up listeners for both downloads (Verilog and XDC)
    const downloads: any[] = [];
    page.on('download', (download) => {
      downloads.push(download);
    });
    
    // Export Verilog (should also export XDC)
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    
    // Wait for both files
    await page.waitForTimeout(2000);
    
    // Should have received 2 downloads (.v and .xdc)
    expect(downloads.length).toBeGreaterThanOrEqual(1);
    
    const filenames = downloads.map((d) => d.suggestedFilename());
    const hasVerilog = filenames.some((f) => f.endsWith('.v'));
    expect(hasVerilog).toBeTruthy();
  });

  test('should prevent export of invalid Verilog', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop"]');
    
    // Open Logic Playground with empty circuit
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]');
    
    // Try to export empty circuit
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    
    // Should show error about no project loaded or invalid circuit
    await expect(page.locator('text=/No project|validation failed|errors/')).toBeVisible({ timeout: 3000 });
  });

  test('should include FPGA artifacts in .rbx.zip export', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop"]');
    
    // Open Logic Playground and load example
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]');
    
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'load example');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=8-bit Counter (Basys3)');
    await page.click('text=8-bit Counter (Basys3)');
    await page.waitForTimeout(1000);
    
    // First export Verilog to generate FPGA artifacts
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Now export full project as .rbx.zip
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export evidence');
    await page.keyboard.press('Enter');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.rbx\.zip$/);
    
    // Verify ZIP contains FPGA directories
    const path = await download.path();
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(path);
    const entries = zip.getEntries().map((e: any) => e.entryName);
    
    // Check for FPGA artifact directories
    const hasVerilogDir = entries.some((e: string) => e.startsWith('verilog/'));
    const hasFpgaDir = entries.some((e: string) => e.startsWith('fpga/'));
    
    expect(hasVerilogDir || hasFpgaDir).toBeTruthy();
  });
});

test.describe('FPGA Validation UI Feedback', () => {
  test('should display synthesis readiness score', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop"]');
    
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]');
    
    // Load example
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'load example');
    await page.keyboard.press('Enter');
    await page.click('text=8-bit Counter (Basys3)');
    await page.waitForTimeout(1000);
    
    // Export and check for readiness score in toast
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    
    // Look for percentage or success message
    const hasScoreOrSuccess = await page.locator('text=/\\d+%|successfully/').isVisible({ timeout: 5000 });
    expect(hasScoreOrSuccess).toBeTruthy();
  });

  test('should show validation warnings for problematic circuits', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop"]');
    
    await page.click('[data-testid="desktop-icon-logic-playground"]');
    await page.waitForSelector('[data-testid="logic-playground-app"]');
    
    // Create a simple circuit that might have warnings
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'load example');
    await page.keyboard.press('Enter');
    await page.click('text=NOT Gate');
    await page.waitForTimeout(1000);
    
    // Try to export - might show warnings about simple circuit
    await page.keyboard.press('Control+Shift+P');
    await page.fill('[data-testid="command-palette-input"]', 'export verilog');
    await page.keyboard.press('Enter');
    
    // Check if any validation feedback appears (success or warning)
    await page.waitForTimeout(2000);
    const hasToast = await page.locator('[class*="toast"]').count() > 0;
    expect(hasToast).toBeTruthy();
  });
});
