// Capture real errors from boot sequence with RB_APP_* visibility
import { test, expect } from '@playwright/test';

test('capture shell boot errors + app registration status', async ({ page }) => {
  const logs = [];
  const errors = [];
  const networkErrors = [];
  const appStatus = { ok: [], failed: [] };
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    logs.push(`[${type}] ${text}`);
    
    // Track app registration status
    if (text.startsWith('RB_APP_OK')) {
      const appName = text.split(' ')[1];
      appStatus.ok.push(appName);
      console.log(`✅ APP: ${appName}`);
    } else if (text.startsWith('RB_APP_FAIL')) {
      const match = text.match(/RB_APP_FAIL\s+(\S+)/);
      if (match) {
        appStatus.failed.push(match[1]);
        console.log(`❌ APP FAILED: ${match[1]}`);
        console.log(`   ${text}`);
      }
    } else if (text.includes('RB_APPS_REGISTER')) {
      console.log(`📋 ${text}`);
    }
    
    if (type === 'error') {
      errors.push(text);
      console.log(`🔴 CONSOLE: ${text}`);
    }
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`🔴 PAGE ERROR: ${err.message}`);
    if (err.stack) {
      console.log(`   Stack:\n${err.stack.split('\n').slice(0, 5).join('\n   ')}`);
    }
  });
  
  page.on('response', res => {
    if (!res.ok() && res.url().includes('localhost')) {
      networkErrors.push(`${res.status()} ${res.statusText()} - ${res.url()}`);
      console.log(`🔴 NETWORK: ${res.status()} ${res.url()}`);
    }
  });
  
  console.log('\n══════════ BOOT TEST START ══════════\n');
  console.log('Navigating to /os/...');
  await page.goto('http://localhost:5173/os/', { waitUntil: 'load' });
  
  // Wait for app registration to complete (or timeout at 5s)
  await page.waitForTimeout(6000);
  
  console.log('\n══════════ CHECKING SHELL ══════════\n');
  const shellVisible = await page.locator('[data-testid="desktop-shell"]')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  
  console.log(`Shell visible: ${shellVisible ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n══════════ APP REGISTRATION SUMMARY ══════════');
  console.log(`Succeeded: ${appStatus.ok.length} - ${appStatus.ok.join(', ')}`);
  console.log(`Failed: ${appStatus.failed.length} - ${appStatus.failed.join(', ')}`);
  
  if (errors.length > 0) {
    console.log('\n══════════ ERRORS ══════════');
    errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
  }
  
  if (networkErrors.length > 0) {
    console.log('\n══════════ NETWORK FAILURES ══════════');
    networkErrors.forEach(e => console.log(`  - ${e}`));
  }
  
  console.log('\n══════════ LAST 30 LOGS ══════════');
  logs.slice(-30).forEach(l => console.log(`  ${l}`));
  
  // Assertion: Shell MUST mount now
  expect(shellVisible).toBe(true);
});
