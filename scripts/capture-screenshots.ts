import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SCREENSHOTS_DIR = join(process.cwd(), 'public', 'screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

interface CaptureConfig {
  name: string;
  path: string;
  selector?: string;
  waitFor?: number;
  setup?: (page: Page) => Promise<void>;
}

const captures: CaptureConfig[] = [
  {
    name: 'studio-desktop',
    path: '/',
    waitFor: 2000,
    setup: async (page) => {
      // Wait for shell to load
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 5000 });
    },
  },
  {
    name: 'logic-playground',
    path: '/',
    waitFor: 3000,
    setup: async (page) => {
      // Wait for shell to load
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 5000 });

      // Open Logic Playground app
      const logicIcon = page.locator('[data-testid="dock-icon-logic-playground"]');
      if (await logicIcon.count() > 0) {
        await logicIcon.click();
        await page.waitForTimeout(1000);
      }
    },
  },
  {
    name: 'home-hero',
    path: '/',
    waitFor: 2000,
    setup: async (page) => {
      // Wait for initial animation
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 5000 });
      await page.waitForTimeout(1000);
    },
  },
  {
    name: 'neon-circuit-wallpaper',
    path: '/',
    waitFor: 2000,
    setup: async (page) => {
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 5000 });

      // Open Settings and change wallpaper
      const settingsIcon = page.locator('[data-testid="dock-icon-settings"]');
      if (await settingsIcon.count() > 0) {
        await settingsIcon.click();
        await page.waitForTimeout(500);

        // Select neon-circuit wallpaper (if UI exists)
        const neonWallpaper = page.locator('[data-wallpaper="neon-circuit"]');
        if (await neonWallpaper.count() > 0) {
          await neonWallpaper.click();
          await page.waitForTimeout(500);
        }

        // Close settings
        const closeButton = page.locator('[data-testid="window-close"]').first();
        if (await closeButton.count() > 0) {
          await closeButton.click();
        }
      }
    },
  },
  {
    name: 'frost-grid-wallpaper',
    path: '/',
    waitFor: 2000,
    setup: async (page) => {
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 5000 });

      // Open Settings and change wallpaper
      const settingsIcon = page.locator('[data-testid="dock-icon-settings"]');
      if (await settingsIcon.count() > 0) {
        await settingsIcon.click();
        await page.waitForTimeout(500);

        // Select frost-grid wallpaper
        const frostWallpaper = page.locator('[data-wallpaper="frost-grid"]');
        if (await frostWallpaper.count() > 0) {
          await frostWallpaper.click();
          await page.waitForTimeout(500);
        }

        // Close settings
        const closeButton = page.locator('[data-testid="window-close"]').first();
        if (await closeButton.count() > 0) {
          await closeButton.click();
        }
      }
    },
  },
];

async function captureScreenshot(
  page: Page,
  config: CaptureConfig
): Promise<void> {
  console.log(`📸 Capturing: ${config.name}`);

  // Navigate to the page
  await page.goto(`${BASE_URL}${config.path}`, { waitUntil: 'networkidle' });

  // Run setup if provided
  if (config.setup) {
    await config.setup(page);
  }

  // Wait for specified time
  if (config.waitFor) {
    await page.waitForTimeout(config.waitFor);
  }

  // Take screenshot
  const outputPath = join(SCREENSHOTS_DIR, `${config.name}.png`);

  if (config.selector) {
    const element = await page.locator(config.selector).first();
    await element.screenshot({ path: outputPath });
  } else {
    await page.screenshot({ path: outputPath, fullPage: false });
  }

  console.log(`✅ Saved: ${outputPath}`);
}

async function main() {
  console.log('🚀 Starting screenshot capture...\n');

  // Create screenshots directory
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Launch browser
  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // Retina display
  });

  const page = await context.newPage();

  // Capture all screenshots
  for (const config of captures) {
    try {
      await captureScreenshot(page, config);
    } catch (error) {
      console.error(`❌ Failed to capture ${config.name}:`, error);
    }
  }

  // Cleanup
  await browser.close();

  console.log('\n✨ Screenshot capture complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
