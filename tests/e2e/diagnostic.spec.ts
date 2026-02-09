// Diagnostic: Check /os/ route for Shell
import { test } from '@playwright/test';

test('Check /os/ for desktop-shell', async ({ page }) => {
  console.log('=== CHECKING /os/ FOR SHELL ===');
  await page.goto('/os/');
  await page.waitForTimeout(3000);
  
  const info = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="desktop-shell"]');
    const testids = Array.from(document.querySelectorAll('[data-testid]')).slice(0, 10).map(el => el.getAttribute('data-testid'));
    const hasShellClass = !!document.querySelector('.shell-container, .rb-shell');
    const bodyStart = document.body.innerHTML.substring(0, 500);
    
    return {
      hasDesktopShell: !!shell,
      testidsCount: testids.length,
      firstTestids: testids,
      hasShellClass,
      bodyPreview: bodyStart,
      url: window.location.href
    };
  });
  
  console.log(JSON.stringify(info, null, 2));
});
