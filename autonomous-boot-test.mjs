// Autonomous boot verification - captures all RB_APP_* logs with full error details
import { chromium } from '@playwright/test';

async function autonomousTest() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  
  const state = {
    appsOk: [],
    appsFailed: [],
    errors: [],
    rbLogs: []
  };
  
  // Capture everything
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    // Track app registration
    if (text.startsWith('RB_APP_OK')) {
      const parts = text.split(' ');
      const appName = parts[1];
      state.appsOk.push(appName);
      console.log(`✅ ${appName}`);
    } 
    else if (text.startsWith('RB_APP_FAIL')) {
      const parts = text.split(' ');
      const appName = parts[1];
      const rest = parts.slice(2).join(' ');
      state.appsFailed.push({ app: appName, error: rest });
      console.log(`\n❌ APP FAILED: ${appName}`);
      console.log(`   ${rest}`);
    }
    else if (text.includes('RB_')) {
      state.rbLogs.push(text);
      console.log(`📋 ${text}`);
    }
    else if (type === 'error') {
      state.errors.push(text);
      console.log(`🔴 ERROR: ${text}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`\n🔴 UNCAUGHT EXCEPTION:`);
    console.log(`   ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split('\n').slice(0, 10);
      lines.forEach(line => console.log(`   ${line}`));
    }
    state.errors.push({ type: 'pageerror', message: err.message, stack: err.stack });
  });
  
  page.on('response', res => {
    if (!res.ok() && res.url().includes('localhost')) {
      console.log(`🔴 ${res.status()} ${res.url()}`);
    }
  });
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   AUTONOMOUS BOOT VERIFICATION TEST   ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('→ Loading http://localhost:5173/os/\n');
  
  try {
    await page.goto('http://localhost:5173/os/', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
  } catch (e) {
    console.log(`⚠️  Page load timeout/error: ${e.message}`);
  }
  
  console.log('\n→ Waiting 8 seconds for app registration...\n');
  await page.waitForTimeout(8000);
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║            BOOT RESULTS                ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // Check shell
  const shellVisible = await page.locator('[data-testid="desktop-shell"]')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  
  console.log(`Shell Container: ${shellVisible ? '✅ VISIBLE' : '❌ NOT VISIBLE'}`);
  console.log(`Apps Succeeded: ${state.appsOk.length}`);
  console.log(`Apps Failed: ${state.appsFailed.length}`);
  console.log(`Console Errors: ${state.errors.length}`);
  
  if (state.appsOk.length > 0) {
    console.log(`\n✅ Successful apps:\n   ${state.appsOk.join(', ')}`);
  }
  
  if (state.appsFailed.length > 0) {
    console.log(`\n❌ Failed apps:`);
    state.appsFailed.forEach(({ app, error }) => {
      console.log(`   • ${app}:`);
      console.log(`     ${error.substring(0, 200)}${error.length > 200 ? '...' : ''}`);
    });
  }
  
  // Look for specific registration logs
  const hasRegisterStart = state.rbLogs.some(l => l.includes('RB_APPS_REGISTER_START'));
  const hasRegisterEnd = state.rbLogs.some(l => l.includes('RB_APPS_REGISTERED') || l.includes('RB_APPS_REGISTER_TIMEOUT'));
  
  console.log(`\nRegistration started: ${hasRegisterStart ? '✅' : '❌'}`);
  console.log(`Registration completed: ${hasRegisterEnd ? '✅' : '❌'}`);
  
  // Final verdict
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           FINAL VERDICT                ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const passed = shellVisible && hasRegisterStart && state.appsOk.length > 0;
  
  if (passed) {
    console.log('✅ BOOT SUCCESSFUL - OS is resilient!');
    console.log('   • Shell mounted despite any app failures');
    console.log('   • Core apps registered');
    console.log('   • Foundation works');
  } else {
    console.log('❌ BOOT FAILED - Issues detected:');
    if (!shellVisible) console.log('   • Shell did not mount');
    if (!hasRegisterStart) console.log('   • App registration did not start');
    if (state.appsOk.length === 0) console.log('   • No apps registered successfully');
  }
  
  console.log('\n→ Browser will stay open for 15s for manual inspection...\n');
  await page.waitForTimeout(15000);
  
  await browser.close();
  
  return passed ? 0 : 1;
}

autonomousTest()
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    console.error('\n🔴 Test crashed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
