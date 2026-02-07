// Diagnostic: Capture ALL console output and errors
import { chromium } from '@playwright/test';

async function captureBootErrors() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const logs = [];
  const errors = [];
  
  page.on('console', msg => {
    const entry = `[${msg.type()}] ${msg.text()}`;
    logs.push(entry);
    console.log(entry);
  });
  
  page.on('pageerror', err => {
    const entry = `[PAGEERROR] ${err.message}\n${err.stack}`;
    errors.push(entry);
    console.error(entry);
  });
  
  page.on('response', res => {
    if (!res.ok()) {
      const entry = `[HTTP ${res.status()}] ${res.url()}`;
      errors.push(entry);
      console.error(entry);
    }
  });
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   FULL BOOT ERROR CAPTURE             ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  try {
    await page.goto('http://localhost:5173/os/', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
  } catch (e) {
    console.error(`\n⚠️ Navigation error: ${e.message}`);
  }
  
  console.log('\n→ Waiting 8 seconds for any lazy errors...\n');
  await page.waitForTimeout(8000);
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   SUMMARY                              ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`Total console logs: ${logs.length}`);
  console.log(`Total errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS DETECTED:\n');
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}\n`));
  }
  
  console.log('\n→ Browser staying open 30s for manual inspection...\n');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

captureBootErrors().catch(err => {
  console.error('\n🔴 Capture failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
