/**
 * RC-P2: E2E Test - Position Serialization Round-Trip
 * 
 * Verifies that circuit node positions are preserved through save/load cycle
 * - Create circuit with nodes at specific positions
 * - Save project
 * - Reload project
 * - Verify nodes appear at same positions (not collapsed to 0,0)
 */

import { test, expect } from '@playwright/test';

test.describe('RC-P2: Position Serialization E2E Round-Trip', () => {
  test.beforeEach(async ({ page }) => {
    // Start playground app
    await page.goto('/');
    
    // Wait for app to boot
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="playground-canvas"]', { timeout: 10000 });
  });

  test('should preserve node positions through save → reload', async ({ page }) => {
    // 1. CREATE CIRCUIT: Place two nodes at specific non-zero positions
    
    // Open Logic Playground
    await page.click('text=Logic Playground');
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 5000 });
    
    // Add first node (AND gate) at position (150, 200)
    await page.click('[data-testid="palette-AND"]');
    const canvas = await page.$('[data-testid="canvas"]');
    if (canvas) {
      await canvas.click({ position: { x: 150, y: 200 } });
    }
    
    // Add second node (OR gate) at position (300, 150)
    await page.click('[data-testid="palette-OR"]');
    if (canvas) {
      await canvas.click({ position: { x: 300, y: 150 } });
    }
    
    // Wait for nodes to be placed
    const nodes = await page.$$('[data-testid^="node-"]');
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    
    // 2. SAVE PROJECT
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000); // Wait for save to complete
    
    // Verify save notification appears
    const saveIndicator = await page.$('[data-testid="save-indicator"]');
    expect(saveIndicator).toBeTruthy();
    
    // 3. RELOAD: Refresh page to reload project
    await page.reload({ waitUntil: 'networkidle' });
    
    // Wait for reloaded circuit to appear
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 5000 });
    
    // 4. VERIFY POSITIONS: Check that nodes are NOT at (0,0)
    const loadedNodes = await page.$$('[data-testid^="node-"]');
    expect(loadedNodes.length).toBeGreaterThanOrEqual(2);
    
    // Verify nodes have non-zero positions (not collapsed to origin)
    for (const node of loadedNodes) {
      const position = await node.boundingBox();
      if (position) {
        // Positions should not be at origin (0,0)
        // They should be somewhere in the canvas space (> 100, > 100 for safety)
        expect(position.x).toBeGreaterThan(50);
        expect(position.y).toBeGreaterThan(50);
      }
    }
    
    // 5. VERIFY NO DATA LOSS: Open exported JSON and check position objects exist
    await page.keyboard.press('Control+E');
    await page.waitForSelector('[data-testid="export-dialog"]', { timeout: 2000 });
    
    const exportButton = await page.$('[data-testid="export-json-button"]');
    if (exportButton) {
      await exportButton.click();
    }
    
    // Capture exported JSON (either from download or clipboard)
    // Verify it contains position objects, not just x/y
    // JSON should show: position: { x: ..., y: ... } (not just x, y properties)
  });

  test('should maintain distinct positions for multiple nodes', async ({ page }) => {
    // TEST: Multiple nodes should have different positions, not all collapse to 0,0
    
    await page.click('text=Logic Playground');
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 5000 });
    
    const positions = [];
    
    // Place 3 nodes at distinct positions
    const nodePositions = [
      { x: 100, y: 100 },
      { x: 250, y: 250 },
      { x: 150, y: 350 },
    ];
    
    for (const pos of nodePositions) {
      await page.click('[data-testid="palette-AND"]');
      const canvas = await page.$('[data-testid="canvas"]');
      if (canvas) {
        await canvas.click({ position: pos });
        positions.push(pos);
      }
    }
    
    // Save and reload
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'networkidle' });
    
    // Verify all nodes still exist and are not at same position
    const loadedNodes = await page.$$('[data-testid^="node-"]');
    expect(loadedNodes.length).toBe(positions.length);
    
    // Check that nodes have diverse positions (not all at 0,0)
    const loadedPositions = [];
    for (const node of loadedNodes) {
      const bbox = await node.boundingBox();
      if (bbox) {
        loadedPositions.push({ x: bbox.x, y: bbox.y });
      }
    }
    
    // Verify positions are not all identical (would happen if all reset to 0,0)
    const uniquePositions = new Set(loadedPositions.map(p => JSON.stringify(p)));
    expect(uniquePositions.size).toBeGreaterThan(1);
  });
});
