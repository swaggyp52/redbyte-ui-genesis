// Minimal test - just load and click
import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  
  //
 Capture ERROR logging from the browser console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`\n🔴 CONSOLE ERROR:\n${msg.text()}\n`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`\n🔴 UNCAUGHT EXCEPTION:`);
    console.log(`Message: ${error.message}`);
    console.log(`Stack:\n${error.stack}\n`);
  });
  
  console.log('Navigating to http://localhost:5173/os/ ...');
  await page.goto('http://localhost:5173/os/', { waitUntil: 'load' });
  
  console.log('Waiting 3 seconds for page to render...');
  await page.waitForTimeout(3000);
  
  // Try to find ANY button with "Logic" or "Build" or "Practice"
  console.log('\nLooking for clickable elements...');
  const found = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, [role="button"]'));
    return all.map(el => ({
      text: el.textContent?.trim().substring(0, 50),
      testId: el.getAttribute('data-testid')
    }));
  });
  
  console.log(`Found ${found.length} clickable elements:`);
  found.forEach((el, i) => {
    if (el.text) console.log(`  ${i}: "${el.text}" ${el.testId ? `[${el.testId}]` : ''}`);
  });
  
  // Try clicking first logic-related button
  console.log('\nAttempting to click logic-related button...');
  const clicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button'));
    for (const btn of all) {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('logic') || text.includes('practice') || text.includes('build')) {
        console.log('Clicking:', btn.textContent?.trim());
        btn.click();
        return { success: true, text: btn.textContent?.trim() };
      }
    }
    return { success: false };
  });
  
  if (clicked.success) {
    console.log(`✅ Clicked: "${clicked.text}"`);
    console.log('Waiting 3 seconds to see if errors appear...');
    await page.waitForTimeout(3000);
    console.log('\n✅ If no red errors above, launch succeeded.');
  } else {
    console.log('❌ Could not find button to click');
  }
  
  console.log('\n⏸️  Browser left open. Manually click Logic Playground and check console.');
  console.log('Press Ctrl+C when done.');
  await page.waitForTimeout(60000);
  
  await browser.close();
}

test().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
