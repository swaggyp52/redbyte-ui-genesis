// Simple diagnostic - just load page and check what's there
import { chromium } from '@playwright/test';

async function diagnose() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Loading http://localhost:5173/os/...\n');
  
  const response = await page.goto('http://localhost:5173/os/', { 
    waitUntil: 'networkidle',
    timeout: 10000 
  });
  
  console.log(`Response status: ${response?.status()}`);
  
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  console.log('Screenshot saved to debug-screenshot.png');
  
  // Get page title
  const title = await page.title();
  console.log(`Page title: "${title}"`);
  
  // Check if Home is visible
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log(`\nPage text content (first 500 chars):\n${bodyText.substring(0, 500)}`);
  
  // Look for any buttons
  const buttons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(b => ({
      text: b.textContent?.trim(),
      testId: b.getAttribute('data-testid'),
      className: b.className
    })).filter(b => b.text);
  });
  
  console.log(`\nFound ${buttons.length} buttons:`);
  buttons.slice(0, 10).forEach(b => {
    console.log(`  • "${b.text}" ${b.testId ? `[${b.testId}]` : ''}`);
  });
  
  // Check for errors in console
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.waitForTimeout(1000);
  
  if (errors.length > 0) {
    console.log(`\n❌ Console errors detected:`);
    errors.forEach(e => console.log(`  ${e}`));
  }
  
  console.log('\n✅ Browser left open - press Ctrl+C when done inspecting');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

diagnose().catch(console.error);
