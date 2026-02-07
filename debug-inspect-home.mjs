// Script to inspect Home page structure
import { chromium } from '@playwright/test';

async function inspectHome() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 CONSOLE ERROR: ${msg.text()}`);
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log(`🔴 PAGE ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    consoleErrors.push({ message: error.message, stack: error.stack });
  });
  
  console.log('=== LOADING HOME ===\n');
  await page.goto('http://localhost:5173/os/');
  await page.waitForTimeout(3000);
  
  console.log('\n=== INSPECTING DOM ===\n');
  
  // Get all clickable elements that might be app cards
  const appCards = await page.evaluate(() => {
    const cards = [];
    
    // Look for common patterns
    const selectors = [
      '[data-app-id]',
      '[data-app]', 
      '.app-card',
      '.card',
      'button:has-text("Logic")',
      'button:has-text("Labs")',
      'button:has-text("Files")',
      '[role="button"]'
    ];
    
    const foundElements = new Set();
    
    selectors.forEach(sel => {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          if (!foundElements.has(el)) {
            foundElements.add(el);
            cards.push({
              selector: sel,
              text: el.textContent?.trim().substring(0, 100),
              className: el.className,
              dataAttrs: [...el.attributes]
                .filter(a => a.name.startsWith('data-'))
                .map(a => `${a.name}="${a.value}"`)
                .join(' '),
              tagName: el.tagName
            });
          }
        });
      } catch (e) {
        // Ignore invalid selectors
      }
    });
    
    return cards;
  });
  
  console.log(`Found ${appCards.length} potential app elements:\n`);
  appCards.forEach((card, i) => {
    console.log(`${i + 1}. ${card.tagName}.${card.className}`);
    console.log(`   Text: "${card.text}"`);
    console.log(`   Data attrs: ${card.dataAttrs || 'none'}`);
    console.log(`   Found via: ${card.selector}\n`);
  });
  
  // Now try clicking the first few that mention "Logic" or "Playground"
  console.log('\n=== ATTEMPTING TO CLICK LOGIC PLAYGROUND ===\n');
  
  const clicked = await page.evaluate(() => {
    const possibleTargets = [
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('[role="button"]'),
      ...document.querySelectorAll('.card')
    ];
    
    for (const el of possibleTargets) {
      const text = el.textContent || '';
      if (text.toLowerCase().includes('logic') || text.toLowerCase().includes('playground')) {
        console.log('Found potential Logic Playground element:', el);
        el.click();
        return { found: true, text: text.trim() };
      }
    }
    return { found: false };
  });
  
  if (clicked.found) {
    console.log(`✅ Clicked element with text: "${clicked.text}"`);
    await page.waitForTimeout(3000);
    
    if (consoleErrors.length > 0) {
      console.log('\n🔴 ERRORS AFTER CLICK:');
      consoleErrors.forEach(err => console.log(err));
    } else {
      console.log('\n✅ No console errors after click');
    }
  } else {
    console.log('❌ Could not find Logic Playground element to click');
  }
  
  console.log('\n⏸️  Browser left open. Press Ctrl+C to close.');
  await page.waitForTimeout(60000);
  
  await browser.close();
}

inspectHome().catch(console.error);
