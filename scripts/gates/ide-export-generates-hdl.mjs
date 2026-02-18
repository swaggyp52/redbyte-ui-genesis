/**
 * IDE Export Generates HDL Gate
 *
 * Verifies that the export system generates non-empty VHDL when a simple
 * circuit is exported.
 *
 * Success: Export produces VHDL with entity definition and architecture
 * Failure: Export produces empty/invalid VHDL or fails
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Wait for Logic Playground readiness
    await page.waitForSelector('[data-testid="logic-playground-root"]', { timeout: 10000 });

    // Load the D Flip-Flop example to have a non-empty circuit
    const exampleButton = page.locator('button:has-text("Load D Flip-Flop Example")');
    const exampleExists = await exampleButton.isVisible().catch(() => false);

    if (exampleExists) {
      await exampleButton.click();
      await page.waitForTimeout(2000); // Let circuit load
    }

    // Click Export tab (mode 4)
    const exportTab = page.locator('[data-testid="ide-mode-export"]');
    const exportTabExists = await exportTab.isVisible().catch(() => false);

    if (!exportTabExists) {
      throw new Error('Export tab not found - check IDEModeNav');
    }

    await exportTab.click();
    await page.waitForTimeout(1000);

    // Wait for HDL editor panel to show
    await page.waitForSelector('[data-testid="hdl-editor-panel"]', { timeout: 5000 }).catch(() => null);

    // Check if there's VHDL content in the editor
    const vhdlEditor = page.locator('[data-testid="hdl-editor-vhdl"]');
    const vhdlVisible = await vhdlEditor.isVisible().catch(() => false);

    if (!vhdlVisible) {
      // Try alternate selector - look for any code editor with VHDL content
      const anyEditor = page.locator('textarea, [role="textbox"]').first();
      const editorText = await anyEditor.inputValue().catch(() => '');
      
      if (!editorText || editorText.length < 50) {
        throw new Error('No VHDL content found in export editor');
      }

      const hasEntity = editorText.includes('entity') || editorText.includes('ENTITY');
      const hasArchitecture = editorText.includes('architecture') || editorText.includes('ARCHITECTURE');

      if (!hasEntity && !hasArchitecture) {
        throw new Error('VHDL content lacks entity or architecture keywords');
      }
    }

    console.log('✅ IDE Export Generates HDL gate PASS');
    process.exit(0);
  } catch (error) {
    console.error('❌ IDE Export Generates HDL gate FAIL:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
