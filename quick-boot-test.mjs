// Quick boot verification against running dev server
import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const appStatus = { ok: [], failed: [] };
  
  page.on('console', msg => {
    const text = msg.text();
    
    if (text.startsWith('RB_APP_OK')) {
      const appName = text.split(' ')[1];
      appStatus.ok.push(appName);
      console.log(`✅ ${appName}`);
    } else if (text.startsWith('RB_APP_FAIL')) {
      const match = text.match(/RB_APP_FAIL\s+(\S+)/);
      if (match) {
        appStatus.failed.push(match[1]);
        console.log(`❌ ${match[1]} FAILED`);
      }
      console.log(`   ${text}`);
    } else if (text.includes('RB_APPS_')) {
      console.log(`📋 ${text}`);
    } else if (text.includes('RB_')) {
      console.log(`   ${text}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`🔴 ${err.message}`);
    if (err.stack) {
      console.log(err.stack.split('\n').slice(0, 5).join('\n'));
    }
  });
  
  console.log('\n══════════ LOADING /os/ ══════════\n');
  await page.goto('http://localhost:5173/os/', { waitUntil: 'load' });
  
  console.log('\n⏳ Waiting 7s for app registration...\n');
  await page.waitForTimeout(7000);
  
  const shellVisible = await page.locator('[data-testid="shell-container"]')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  
  console.log('\n══════════ RESULTS ══════════');
  console.log(`Shell visible: ${shellVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`Apps OK: ${appStatus.ok.length} - ${appStatus.ok.join(', ')}`);
  console.log(`Apps FAILED: ${appStatus.failed.length} - ${appStatus.failed.join(', ')}`);
  
  if (!shellVisible) {
    console.log('\n⚠️  SHELL DID NOT MOUNT');
  }
  
  console.log('\n⏸️  Browser open for 20s...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  process.exit(shellVisible && appStatus.failed.length === 0 ? 0 : 1);
}

test().catch(err => {
  console.error('Test error:', err.message);
  process.exit(1);
});
