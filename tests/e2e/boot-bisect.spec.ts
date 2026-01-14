import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createFailureWatcher } from './helpers';

const BASE_URL = '/?boot=bisect';

const saveArtifacts = (testInfo: any, logs: string[], ringBuffer?: any[]) => {
  const consoleOut = testInfo.outputPath('console.log');
  fs.writeFileSync(consoleOut, logs.slice(-1000).join('\n'), 'utf8');
  if (ringBuffer && ringBuffer.length > 0) {
    const ringOut = testInfo.outputPath('ring-buffer.json');
    fs.writeFileSync(ringOut, JSON.stringify(ringBuffer.slice(-200), null, 2), 'utf8');
  }
};

/**
 * Static HTML health check: Proves the preview server/environment doesn't kill tabs outright.
 * If this fails, the issue is server-level (webServer lifecycle, port reuse, etc).
 */
test('[BOOT-HEALTH] Static HTML stays open', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`));

  const failure = createFailureWatcher(page, '/health.html');

  try {
    await page.goto('/health.html', { waitUntil: 'domcontentloaded' });

    const marker = page.locator('#static-health');
    const visible = await marker.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      throw new Error('[BOOT-HEALTH] Marker #static-health not visible');
    }

    // Stay open for 3 seconds
    const died = await Promise.race([
      failure.failPromise.then(() => true).catch(() => true),
      page.waitForTimeout(3000).then(() => false),
    ]);

    if (died) {
      throw new Error('[BOOT-HEALTH] Page closed during 3s wait');
    }

    saveArtifacts(testInfo, logs);
  } catch (e) {
    saveArtifacts(testInfo, logs);
    throw e;
  } finally {
    failure.dispose();
  }
});

/**
 * TRUE Step 0: Only React + react-dom, no CSS, no rb-* packages.
 * If this fails but static health passes, the killer is a JS bootstrap side effect.
 */
test('[BOOT-TRUE-STEP-0] Minimal React entry stays open', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`));

  const url = '/?boot=bisect&step=-1'; // Special: TRUE Step 0
  const failure = createFailureWatcher(page, url);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const marker = page.locator('#boot-bisect[data-step="true-0"]');
    const visible = await marker.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      throw new Error('[BOOT-TRUE-STEP-0] Marker #boot-bisect not visible');
    }

    // Stay open for 3 seconds
    const died = await Promise.race([
      failure.failPromise.then(() => true).catch(() => true),
      page.waitForTimeout(3000).then(() => false),
    ]);

    if (died) {
      throw new Error('[BOOT-TRUE-STEP-0] Page closed during 3s wait');
    }

    saveArtifacts(testInfo, logs);
  } catch (e) {
    saveArtifacts(testInfo, logs);
    throw e;
  } finally {
    failure.dispose();
  }
});

/**
 * Regular bisect steps 0-5 for module-level bisection.
 * Only run this if both health and TRUE Step 0 pass.
 */
test('[BOOT-BISECT] Steps 0–5 markers appear', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`));

  let failingStep: number | null = null;

  for (let step = 0; step <= 5; step++) {
    const url = `${BASE_URL}&step=${step}`;
    const failure = createFailureWatcher(page, url);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const marker = page.locator('#boot-bisect');
      const visible = await marker.isVisible({ timeout: 2000 }).catch(() => false);
      if (!visible) {
        failingStep = step;
        break;
      }

      const died = await Promise.race([
        failure.failPromise.then(() => true).catch(() => true),
        page.waitForTimeout(3000).then(() => false),
      ]);

      if (died) {
        failingStep = step;
        break;
      }
    } catch (e) {
      failingStep = step;
      break;
    } finally {
      failure.dispose();
    }
  }

  saveArtifacts(testInfo, logs);

  if (failingStep !== null) {
    throw new Error(`[BOOT-BISECT] First failing step: ${failingStep}`);
  }
});

