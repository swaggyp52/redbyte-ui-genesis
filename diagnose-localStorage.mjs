import { chromium } from 'playwright';

async function diagnoseLocalStorage() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   LOCALSTORAGE DIAGNOSTIC              ║');
  console.log('╚════════════════════════════════════════╝\n');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('→ Loading OS...\n');
    await page.goto('http://localhost:5173/os/', { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });

    // Give it a moment to settle
    await page.waitForTimeout(2000);

    console.log('→ Checking localStorage contents...\n');
    
    const storageData = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        data[key] = value;
      }
      return data;
    });

    console.log('📋 localStorage entries:');
    console.log(JSON.stringify(storageData, null, 2));

    // Check for problematic entries
    console.log('\n✅ Analyzing entries...\n');
    
    const problematicKeys = [];
    for (const [key, value] of Object.entries(storageData)) {
      if (key === 'rb:home:recent' && value) {
        try {
          const recent = JSON.parse(value);
          console.log(`• rb:home:recent: ${JSON.stringify(recent)}`);
          if (recent.appId === 'start-here') {
            problematicKeys.push(key);
            console.log('  ⚠️ References removed app "start-here"');
          }
        } catch (e) {
          console.log(`• rb:home:recent: (invalid JSON)`);
          problematicKeys.push(key);
        }
      }
      if (key.includes('window') || key.includes('layout')) {
        console.log(`• ${key}: ${value.substring(0, 100)}...`);
      }
      if (key.includes('dock')) {
        console.log(`• ${key}: ${value.substring(0, 100)}...`);
      }
    }

    // Check sessionStorage too
    console.log('\n→ Checking sessionStorage...\n');
    const sessionData = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        data[key] = value;
      }
      return data;
    });

    if (Object.keys(sessionData).length > 0) {
      console.log('📋 sessionStorage entries:');
      console.log(JSON.stringify(sessionData, null, 2));
    } else {
      console.log('(empty)');
    }

    if (problematicKeys.length > 0) {
      console.log('\n⚠️ FOUND PROBLEMATIC ENTRIES:');
      problematicKeys.forEach(key => console.log(`  • ${key}`));
      console.log('\n→ Clearing problematic entries...');
      await page.evaluate((keys) => {
        keys.forEach(key => localStorage.removeItem(key));
      }, problematicKeys);
      console.log('✅ Cleared. Reload the page to see if UI works.');
    }

  } catch (error) {
    console.log(`🔴 Diagnostic failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

diagnoseLocalStorage().catch(console.error);
