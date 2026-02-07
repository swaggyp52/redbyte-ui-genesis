import { chromium } from 'playwright';

async function checkStorageBeforeBoot() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   PRE-BOOT STORAGE CHECK               ║');
  console.log('╚════════════════════════════════════════╝\n');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Set a listener BEFORE loading the page
    let errorLogged = false;
    page.on('console', msg => {
      if (msg.text().includes('start-here')) {
        console.log(`→ Console: ${msg.text()}`);
        if (msg.text().includes('App not found')) {
          errorLogged = true;
        }
      }
    });

    console.log('→ Loading OS...');
    await page.goto('http://localhost:5173/os/', { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });

    console.log('→ Waiting 2s for messages...');
    await page.waitForTimeout(2000);

    // Now check storage
    console.log('\n→ Checking storage entries that reference start-here:\n');
    const hasStartHere = await page.evaluate(() => {
      const searchables = {
        localStorage: {},
        sessionStorage: {}
      };

      // Check all localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (value && value.includes('start-here')) {
          searchables.localStorage[key] = value.substring(0, 200);
        }
      }

      // Check all sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        if (value && value.includes('start-here')) {
          searchables.sessionStorage[key] = value.substring(0, 200);
        }
      }

      return searchables;
    });

    if (Object.keys(hasStartHere.localStorage).length > 0) {
      console.log('📋 localStorage entries with "start-here":');
      Object.entries(hasStartHere.localStorage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}...`);
      });
    } else {
      console.log('✅ No localStorage entries reference "start-here"');
    }

    if (Object.keys(hasStartHere.sessionStorage).length > 0) {
      console.log('\n📋 sessionStorage entries with "start-here":');
      Object.entries(hasStartHere.sessionStorage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}...`);
      });
    } else {
      console.log('✅ No sessionStorage entries reference "start-here"');
    }

    if (errorLogged) {
      console.log('\n⚠️ The "App not found {appId: start-here}" error was triggered!');
      console.log('→ This suggests code is trying to open or reference start-here');
    }

  } catch (error) {
    console.log(`🔴 Diagnostic failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

checkStorageBeforeBoot().catch(console.error);
