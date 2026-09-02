// Exact-viewport captures of the P2.5D workbench states against the running dev server.
// Browser-E0 evidence only. Usage: node capture.mjs [baseUrl]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? 'http://localhost:5173';
const VIEWPORTS = [
  { tag: '1440x900', width: 1440, height: 900, scale: 1 },
  { tag: '1366x768', width: 1366, height: 768, scale: 1 },
  { tag: '1440x900@125', width: 1152, height: 720, scale: 1.25 },
  { tag: '1440x900@200', width: 720, height: 450, scale: 2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickTestId(page, id, timeout = 8000) {
  const el = page.locator(`[data-testid="${id}"]`).first();
  await el.waitFor({ state: 'attached', timeout });
  await el.evaluate((node) => node.click());
}

async function openStarter(page, exampleId) {
  // Landing first; fall back to File > Open Starter when a project is already loaded.
  const landing = page.locator(`[data-testid="ide-project-landing-example-${exampleId}"]`).first();
  if (await landing.count()) {
    await landing.evaluate((node) => node.click());
  } else {
    await clickTestId(page, 'ide-menu-file');
    await clickTestId(page, 'ide-menu-item-project.open-starter');
    await clickTestId(page, `ide-project-landing-example-${exampleId}`);
    const close = page.locator('[data-testid="ide-project-starter-picker-close"]');
    if (await close.count()) await close.evaluate((node) => node.click()).catch(() => {});
  }
  await sleep(1200);
}

async function mode(page, id) {
  await clickTestId(page, `mode-button-${id}`);
  await sleep(1500);
}

async function shot(page, name, tag) {
  const path = join(here, `${name}.${tag}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function run() {
  const browser = await chromium.launch();
  const written = [];
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.scale,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(800);
    written.push(await shot(page, '01-project-landing', vp.tag));

    await openStarter(page, 'full-adder');
    await mode(page, 'project');
    written.push(await shot(page, '02-project-overview', vp.tag));
    await mode(page, 'design');
    const fit = page.locator('[data-testid="ide-design-fit-circuit-canvas"]');
    if (await fit.count()) await fit.evaluate((node) => node.click());
    await sleep(400);
    written.push(await shot(page, '03-design-full-adder', vp.tag));
    await mode(page, 'verify');
    written.push(await shot(page, '04-simulate-cases', vp.tag));
    await clickTestId(page, 'ide-vcb-run');
    await sleep(1500);
    // Compare auto-enters the Waveform document; 05 is the Cases document after the run.
    await page.locator('[data-testid^="ide-doc-tab-cases:"], [data-testid^="ide-doc-tab-timing:"]').first().evaluate((node) => node.click());
    await page.waitForSelector('[data-testid="ide-verify-lab-grid"][data-studio-mode="scenario"]', { timeout: 8000 }).catch(() => {});
    await sleep(500);
    written.push(await shot(page, '05-simulate-cases-after-compare', vp.tag));
    const replay = page.locator('[data-testid^="ide-doc-tab-waveform:"]');
    await replay.waitFor({ state: 'attached', timeout: 8000 });
    
    await replay.evaluate((node) => node.click());
    await page.waitForSelector('[data-testid="ide-verify-lab-grid"][data-studio-mode="replay"]', { timeout: 8000 });
    await sleep(600);
    written.push(await shot(page, '06-simulate-waveform', vp.tag));
    await mode(page, 'hardware');
    written.push(await shot(page, '07-board', vp.tag));
    await mode(page, 'export');
    written.push(await shot(page, '08-package', vp.tag));

    await openStarter(page, 'four-bit-adder-hierarchical');
    await mode(page, 'design');
    if (await fit.count()) await fit.evaluate((node) => node.click());
    await sleep(400);
    written.push(await shot(page, '09-design-hierarchical-adder', vp.tag));

    await openStarter(page, 'two-bit-counter');
    await mode(page, 'verify');
    written.push(await shot(page, '10-simulate-timing-counter', vp.tag));
    await mode(page, 'design');
    if (await fit.count()) await fit.evaluate((node) => node.click());
    await sleep(400);
    written.push(await shot(page, '11-design-counter', vp.tag));

    const body = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth, scrollH: document.documentElement.scrollHeight, innerH: innerHeight }));
    console.log(vp.tag, 'body', JSON.stringify(body), 'console errors', errors.length, errors.slice(0, 3));
    await context.close();
  }
  await browser.close();
  await mkdir(here, { recursive: true });
  console.log('captures:', written.length);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
