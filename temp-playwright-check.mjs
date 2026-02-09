import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://127.0.0.1:4173/os/', {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
  });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="desktop-shell"]');
    const crash = document.querySelector('[data-testid="rb-crash-beacon"]');
    const testids = Array.from(document.querySelectorAll('[data-testid]'))
      .slice(0, 5)
      .map((el) => el.getAttribute('data-testid'));

    return {
      hasShell: Boolean(shell),
      testids,
      crashBeacon: crash ? crash.textContent : null,
    };
  });

  console.log(JSON.stringify(info, null, 2));
} catch (error) {
  console.error('ERROR', error?.message ?? String(error));
} finally {
  await browser.close();
}
