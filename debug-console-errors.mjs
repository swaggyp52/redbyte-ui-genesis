// Debug script to capture console errors when launching apps
import { chromium } from '@playwright/test';

const apps = [
  'logic-playground',
  'labs', 
  'files',
  'terminal',
  'settings',
  'submission-inspector'
];

async function captureAppErrors() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleErrors = [];
  const networkErrors = [];
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push({
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      type: 'pageerror'
    });
  });
  
  // Capture network failures
  page.on('response', response => {
    if (!response.ok()) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  console.log('=== LOADING HOME PAGE ===\n');
  await page.goto('http://localhost:5173/os/');
  await page.waitForTimeout(3000); // Let initial load finish
  
  console.log('=== TESTING APP LAUNCHERS ===\n');
  
  for (const appName of apps) {
    console.log(`\n--- Testing: ${appName} ---`);
    const errorsBefore = consoleErrors.length;
    const networkBefore = networkErrors.length;
    
    try {
      // Try to find and click the app card on Home
      const appCard = page.locator(`[data-app-id="${appName}"], [data-app="${appName}"]`).first();
      const isVisible = await appCard.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (!isVisible) {
        console.log(`❌ App card not found for: ${appName}`);
        continue;
      }
      
      await appCard.click();
      await page.waitForTimeout(2000); // Wait for app to load/crash
      
      const newErrors = consoleErrors.slice(errorsBefore);
      const newNetwork = networkErrors.slice(networkBefore);
      
      if (newErrors.length > 0) {
        console.log(`🔴 CONSOLE ERRORS (${newErrors.length}):`);
        newErrors.forEach((err, i) => {
          console.log(`\nError ${i + 1}:`);
          console.log(`  Text: ${err.text}`);
          if (err.stack) {
            console.log(`  Stack:\n${err.stack}`);
          }
          if (err.location) {
            console.log(`  Location: ${JSON.stringify(err.location)}`);
          }
        });
      }
      
      if (newNetwork.length > 0) {
        console.log(`\n🔴 NETWORK FAILURES (${newNetwork.length}):`);
        newNetwork.forEach(net => {
          console.log(`  ${net.status} ${net.statusText}: ${net.url}`);
        });
      }
      
      if (newErrors.length === 0 && newNetwork.length === 0) {
        console.log(`✅ No errors detected`);
      }
      
    } catch (error) {
      console.log(`❌ Failed to test ${appName}: ${error.message}`);
    }
  }
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total console errors: ${consoleErrors.length}`);
  console.log(`Total network failures: ${networkErrors.length}`);
  
  // Keep browser open for manual inspection
  console.log('\n⏸️  Browser left open for manual inspection. Press Ctrl+C to close.');
  await page.waitForTimeout(60000);
  
  await browser.close();
}

captureAppErrors().catch(console.error);
