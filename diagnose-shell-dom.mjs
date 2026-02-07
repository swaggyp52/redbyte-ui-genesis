// Diagnostic: What's actually in the Shell DOM
import { chromium } from '@playwright/test';

async function inspectShellDOM() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   SHELL DOM STRUCTURE DIAGNOSTIC      ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  await page.goto('http://localhost:5173/os/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="desktop-shell"]', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Get shell structure
  const shellHTML = await page.locator('[data-testid="desktop-shell"]').evaluate(el => {
    return {
      hasTaskbar: !!el.querySelector('[class*="taskbar"]') || !!el.querySelector('[class*="dock"]') || !!el.querySelector('[data-testid="taskbar"]'),
      hasWindows: !!el.querySelector('.window-container'),
      classList: Array.from(el.classList),
      childCount: el.children.length,
      childTags: Array.from(el.children).map(c => ({ 
        tag: c.tagName, 
        classes: Array.from(c.classList),
        hasChildren: c.children.length > 0,
        testid: c.getAttribute('data-testid')
      }))
    };
  });
  
  console.log('Shell structure:', JSON.stringify(shellHTML, null, 2));
  
  // Look for any app buttons
  const appButtons = await page.locator('[data-appid]').all();
  console.log(`\nApp buttons found: ${appButtons.length}`);
  
  // Look for taskbar/dock
  const taskbarVariants = [
    '[class*="taskbar"]',
    '[class*="Taskbar"]', 
    '[class*="dock"]',
    '[class*="Dock"]',
    '[data-testid*="taskbar"]',
    '[data-testid*="dock"]'
  ];
  
  for (const selector of taskbarVariants) {
    const found = await page.locator(selector).count();
    if (found > 0) {
      console.log(`✓ Found ${found} elements matching: ${selector}`);
    }
  }
  
  // Check getApp function
  const appRegistryState = await page.evaluate(() => {
    const win = window;
    if (win.__RB_APPS_REGISTERED__) {
      return { registered: true, appNames: Object.keys(win.__RB_APP_REGISTRY__ || {}) };
    }
    return { registered: false };
  });
  
  console.log('\nApp registry state:', JSON.stringify(appRegistryState, null, 2));
  
  console.log('\n→ Browser staying open 30s...\n');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

inspectShellDOM().catch(err => {
  console.error('\n🔴 Diagnostic failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
