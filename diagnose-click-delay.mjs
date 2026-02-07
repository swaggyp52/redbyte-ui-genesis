// Diagnostic: App click delay investigation
import { chromium } from '@playwright/test';

async function diagnoseClickDelay() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  
  const events = [];
  
  // Capture all events with timestamps
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('RB_') || text.includes('openWindow') || text.includes('mounting') || text.includes('render')) {
      events.push({ time: Date.now(), type: 'console', text });
      console.log(`[${Date.now()}] ${text}`);
    }
  });
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   APP CLICK DELAY DIAGNOSTIC          ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('→ Loading OS...\n');
  await page.goto('http://localhost:5173/os/', { waitUntil: 'domcontentloaded' });
  
  console.log('→ Waiting for Shell to mount...\n');
  await page.waitForSelector('[data-testid="desktop-shell"]', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  console.log('→ Looking for dock icons...\n');
  const dockButtons = await page.locator('[data-testid^="dock-icon-"]').all();
  console.log(`Found ${dockButtons.length} dock buttons\n`);
  
  if (dockButtons.length > 0) {
    console.log('→ Clicking home dock button...\n');
    const clickTime = Date.now();
    events.push({ time: clickTime, type: 'USER_ACTION', text: 'CLICKED_HOME' });
    
    // Find the home button
    const homeButton = await page.locator('[data-testid="dock-icon-home"]').first();
    await homeButton.click();
    
    console.log('→ Waiting 5 seconds to observe what happens...\n');
    await page.waitForTimeout(5000);
    
    // Check if window appeared
    const windows = await page.locator('.window-container').all();
    console.log(`\nWindows visible: ${windows.length}`);
    
    if (windows.length > 0) {
      const windowTime = Date.now();
      const delay = windowTime - clickTime;
      console.log(`⏱️ Window appeared ${delay}ms after click`);
    } else {
      console.log('❌ No window appeared after 5 seconds');
    }
  }
  
  console.log('\n→ Trying keyboard shortcut Ctrl+K...\n');
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(3000);
  
  const windowsAfterShortcut = await page.locator('.window-container').all();
  console.log(`Windows after Ctrl+K: ${windowsAfterShortcut.length}`);
  
  console.log('\n→ Browser staying open 20s for inspection...\n');
  await page.waitForTimeout(20000);
  
  await browser.close();
}

diagnoseClickDelay().catch(err => {
  console.error('\n🔴 Diagnostic failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
