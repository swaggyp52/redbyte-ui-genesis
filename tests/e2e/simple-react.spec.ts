import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Health page works', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[error] ${err.message}`));

  await page.goto('/health.html');
  const marker = page.locator('#static-health');
  await expect(marker).toBeVisible();

  fs.writeFileSync(testInfo.outputPath('console.log'), logs.join('\n'));
});

test('React CDN only', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[error] ${err.message}`));

  const response = await page.goto('/react-only.html', { waitUntil: 'domcontentloaded' });
  logs.push(`[nav] status=${response?.status()}`);
  await page.waitForTimeout(1000);

  fs.writeFileSync(testInfo.outputPath('console.log'), logs.join('\n'));
});

test('Simple React CDN loads', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[error] ${err.message}`));

  const response = await page.goto('/simple-react.html', { waitUntil: 'domcontentloaded' });
  logs.push(`[nav] status=${response?.status()}`);
  await page.waitForTimeout(2000);

  fs.writeFileSync(testInfo.outputPath('console.log'), logs.join('\n'));
});
