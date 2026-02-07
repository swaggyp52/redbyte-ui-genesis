// Diagnose Logic Playground loading failure
import { chromium } from '@playwright/test';

async function diagnosePlayground() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const errors = [];
  const logs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    logs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.log(`❌ ${text}`);
      errors.push(text);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`\n🔴 UNCAUGHT ERROR: ${err.message}`);
    console.log(err.stack);
    errors.push({ type: 'uncaught', message: err.message, stack: err.stack });
  });
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   LOGIC PLAYGROUND DIAGNOSTIC         ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('→ Loading OS...\n');
  await page.goto('http://localhost:5173/os/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  
  console.log('→ Waiting for Shell to boot...\n');
  await page.waitForTimeout(4000);
  
  console.log('→ Attempting to open Logic Playground via browser console...\n');
  
  // Try to open Logic Playground directly via the window object
  const openResult = await page.evaluate(() => {
    try {
      // Check if openWindow function exists
      if (typeof window.openWindow === 'function') {
        window.openWindow('logic-playground');
        return { success: true, method: 'direct' };
      }
      
      // Try via Ctrl+K search
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        code: 'KeyK',
        ctrlKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);
      
      return { success: true, method: 'keyboard' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  console.log('Open attempt result:', JSON.stringify(openResult, null, 2));
  
  console.log('\n→ Waiting 5 seconds to see what happens...\n');
  await page.waitForTimeout(5000);
  
  // Check if any windows opened
  const windowsCount = await page.locator('.window-container').count();
  console.log(`Windows found: ${windowsCount}`);
  
  if (windowsCount > 0) {
    console.log('\n✅ Window opened successfully');
    
    // Check window content
    const windowContent = await page.locator('.window-container').first().evaluate(el => {
      return {
        classes: Array.from(el.classList),
        hasContent: el.children.length > 0,
        childCount: el.children.length
      };
    });
    console.log('Window content:', JSON.stringify(windowContent, null, 2));
  } else {
    console.log('\n❌ No windows opened');
  }
  
  console.log('\n→ Checking for errors...\n');
  console.log(`Total errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n🔴 ERRORS DETECTED:\n');
    errors.forEach((err, i) => {
      if (typeof err === 'string') {
        console.log(`${i + 1}. ${err}`);
      } else {
        console.log(`${i + 1}. [${err.type}] ${err.message}`);
        if (err.stack) console.log(err.stack.split('\n').slice(0, 5).join('\n'));
      }
    });
  }
  
  console.log('\n→ Browser staying open 30s for manual inspection...\n');
  await page.waitForTimeout(30000);
  
  await browser.close();
  
  return errors.length === 0 ? 0 : 1;
}

diagnosePlayground()
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    console.error('\n🔴 Diagnostic crashed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
