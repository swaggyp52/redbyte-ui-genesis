// Check what's blocking dock clicks
import { chromium } from '@playwright/test';

async function findBlocker() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   DOCK CLICK BLOCKER DIAGNOSTIC       ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  await page.goto('http://localhost:5173/os/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Wait for everything to load
  
  // Check if dock is visible
  const dockVisible = await page.locator('nav[aria-label="Application Dock"]').isVisible();
  console.log(`Dock visible: ${dockVisible ? '✅' : '❌'}`);
  
  if (dockVisible) {
    // Get dock position
    const dockBox = await page.locator('nav[aria-label="Application Dock"]').boundingBox();
    console.log('\nDock bounding box:', dockBox);
    
    // Check button visibility and position
    const homeButton = await page.locator('[data-testid="dock-icon-home"]');
    const buttonVisible = await homeButton.isVisible().catch(() => false);
    console.log(`\nHome button visible: ${buttonVisible ? '✅' : '❌'}`);
    
    if (buttonVisible) {
      const homeBox = await homeButton.boundingBox();
      console.log('Home button box:', homeBox);
      
      // Check what element is at the button's position
      const elementAtPoint = await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        return {
          tag: el.tagName,
          classes: Array.from(el.classList),
          id: el.id,
          dataTestid: el.getAttribute('data-testid'),
          zIndex: window.getComputedStyle(el).zIndex,
          pointerEvents: window.getComputedStyle(el).pointerEvents
        };
      }, [homeBox.x + homeBox.width / 2, homeBox.y + homeBox.height / 2]);
      
      console.log('\n Element at button center:', JSON.stringify(elementAtPoint, null, 2));
    }
  }
  
  console.log('\n→ Browser staying open 30s...\n');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

findBlocker().catch(err => {
  console.error('\n🔴 Diagnostic failed:', err.message);
  process.exit(1);
});
