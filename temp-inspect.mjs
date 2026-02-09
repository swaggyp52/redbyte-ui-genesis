import { chromium } from '@playwright/test';
(async () => {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4173/os/', {waitUntil: 'domcontentloaded', timeout: 10000});
    await page.waitForTimeout(3000);
    const testids = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('[data-testid]'));
      return all.slice(0, 20).map(el => ({ tag: el.tagName, testid: el.getAttribute('data-testid'), visible: el.offsetParent !== null }));
    });
    console.log(JSON.stringify(testids, null, 2));
  } catch(e) {
    console.log('ERROR:', e.message);
  }
  await browser.close();
})();
