// Final debug script with correct selectors
import { chromium } from '@playwright/test';

// Map of mission test IDs to their target app IDs
const MISSIONS = {
  'home-mission-ce-practice': 'logic-playground',
  'home-mission-ce-labs': 'labs',
  'home-mission-ce-examples': 'logic-playground (examples)',
  'home-mission-studio-build': 'logic-playground',
  'home-mission-studio-labs': 'labs',
  'home-mission-studio-learn': 'logic-playground (learn)',
  'home-mission-studio-export': 'submission-inspector'
};

async function debugAppLaunches() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const allErrors = [];
  const allNetworkErrors = [];
  
  // Capture console errors with full details
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const error = {
        type: 'console',
        text: msg.text(),
        location: msg.location(),
        args: msg.args().map(a => a.toString()),
        timestamp: new Date().toISOString()
      };
      allErrors.push(error);
      console.log(`\n🔴 CONSOLE ERROR:`);
      console.log(`   ${msg.text()}`);
      if (msg.location().url) {
        console.log(`   @ ${msg.location().url}:${msg.location().lineNumber}`);
      }
    }
  });
  
  // Capture page errors (uncaught exceptions)
  page.on('pageerror', error => {
    const err = {
      type: 'pageerror',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    allErrors.push(err);
    console.log(`\n🔴 UNCAUGHT EXCEPTION:`);
    console.log(`   ${error.message}`);
    if (error.stack) {
      console.log(`\n   Stack trace:`);
      error.stack.split('\n').forEach(line => console.log(`   ${line}`));
    }
  });
  
  // Capture failed network requests
  page.on('response', response => {
    if (!response.ok() && response.url().includes('localhost')) {
      const err = {
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      };
      allNetworkErrors.push(err);
      console.log(`\n🔴 NETWORK FAILURE: ${response.status()} ${response.statusText}`);
      console.log(`   ${response.url()}`);
    }
  });
  
  console.log('=== LOADING HOME ===\n');
  await page.goto('http://localhost:5173/os/');
  await page.waitForTimeout(2000);
  
  console.log('\n=== TESTING APP LAUNCHES ===\n');
  
  const results = [];
  
  for (const [testId, appName] of Object.entries(MISSIONS)) {
    console.log(`\n--- Testing: ${testId} → ${appName} ---`);
    
    const errorsBefore = allErrors.length;
    const networkBefore = allNetworkErrors.length;
    
    try {
      const button = page.locator(`[data-testid="${testId}"]`);
      const visible = await button.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (!visible) {
        console.log(`⚠️  Mission button not found (may be wrong mode)`);
        results.push({
          mission: testId,
          app: appName,
          status: 'not-found',
          errors: [],
          networkErrors: []
        });
        continue;
      }
      
      await button.click();
      console.log(`✅ Clicked mission button`);
      await page.waitForTimeout(2500); // Wait for app to load or crash
      
      const newErrors = allErrors.slice(errorsBefore);
      const newNetwork = allNetworkErrors.slice(networkBefore);
      
      results.push({
        mission: testId,
        app: appName,
        status: newErrors.length > 0 ? 'error' : 'ok',
        errors: newErrors,
        networkErrors: newNetwork
      });
      
      if (newErrors.length > 0) {
        console.log(`❌ ${newErrors.length} error(s) detected`);
      } else if (newNetwork.length > 0) {
        console.log(`⚠️  ${newNetwork.length} network failure(s)`);
      } else {
        console.log(`✅ No errors`);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      results.push({
        mission: testId,
        app: appName,
        status: 'test-error',
        testError: error.message,
        errors: [],
        networkErrors: []
      });
    }
  }
  
  // =========================================================================
  // REALITY TABLE
  // =========================================================================
  console.log('\n\n' + '='.repeat(80));
  console.log('REALITY TABLE');
  console.log('='.repeat(80) + '\n');
  
  results.forEach(result => {
    if (result.status === 'not-found') return; // Skip wrong-mode missions
    
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Launch: ${result.mission}`);
    console.log(`Target App: ${result.app}`);
    console.log(`${'─'.repeat(80)}`);
    
    console.log(`\n**Expected:** App window opens, renders without errors`);
    console.log(`**Actual:** ${result.status === 'ok' ? '✅ Launched successfully' : '❌ ERRORS DETECTED'}`);
    
    if (result.networkErrors.length > 0) {
      console.log(`\n**Network Failures:**`);
      result.networkErrors.forEach(net => {
        console.log(`  • ${net.status} ${net.statusText}: ${net.url}`);
      });
    }
    
    if (result.errors.length > 0) {
      console.log(`\n**Console Errors (${result.errors.length}):**\n`);
      result.errors.forEach((err, i) => {
        console.log(`Error ${i + 1}:`);
        if (err.type === 'pageerror') {
          console.log(`  Message: ${err.message}`);
          if (err.stack) {
            console.log(`  Stack:`);
            err.stack.split('\n').forEach(line => console.log(`    ${line}`));
          }
        } else {
          console.log(`  ${err.text}`);
          if (err.location?.url) {
            console.log(`  @ ${err.location.url}:${err.location.lineNumber}`);
          }
        }
        console.log('');
      });
    }
    
    if (result.status === 'ok' && result.networkErrors.length === 0) {
      console.log(`\n**Root Cause:** None - launch succeeded`);
    } else if (result.errors.length > 0) {
      const firstError = result.errors[0];
      console.log(`\n**Root Cause Analysis Required:**`);
      console.log(`  First error: ${firstError.type === 'pageerror' ? firstError.message : firstError.text}`);
      console.log(`  File: ${firstError.location?.url || firstError.stack?.split('\n')[1] || 'unknown'}`);
    }
  });
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total missions tested: ${results.filter(r => r.status !== 'not-found').length}`);
  console.log(`Successful: ${results.filter(r => r.status === 'ok').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'error').length}`);
  console.log(`Total console errors: ${allErrors.length}`);
  console.log(`Total network failures: ${allNetworkErrors.length}`);
  
  console.log('\n⏸️  Browser left open for inspection. Ctrl+C to close.');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

debugAppLaunches().catch(console.error);
