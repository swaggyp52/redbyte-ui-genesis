import { test } from '@playwright/test';
import fs from 'node:fs';

interface DiagnosticInfo {
  pageerrors: Array<{ message: string; stack?: string; time: number }>;
  consoleLogs: Array<{ type: string; text: string; time: number }>;
  scriptResponses: Array<{ url: string; status: number; contentType?: string; time: number }>;
  requestsFailed: Array<{ url: string; error: string; time: number }>;
}

const createDiagnosticCollector = () => {
  const diag: DiagnosticInfo = {
    pageerrors: [],
    consoleLogs: [],
    scriptResponses: [],
    requestsFailed: [],
  };
  return { diag };
};

test('[JS-HEALTH] Static HTML (health.html) baseline', async ({ page }, testInfo) => {
  const { diag } = createDiagnosticCollector();
  const startTime = Date.now();

  page.on('console', (msg) => {
    diag.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() - startTime });
  });
  page.on('pageerror', (err) => {
    diag.pageerrors.push({ message: err.message, stack: err.stack, time: Date.now() - startTime });
  });

  await page.goto('/health.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  fs.writeFileSync(testInfo.outputPath('diagnostic.json'), JSON.stringify({ test: 'health.html', diag }, null, 2));

  if (diag.pageerrors.length > 0) {
    throw new Error(`Static HTML failed: ${diag.pageerrors[0].message}`);
  }
});

test('[JS-HEALTH] React 18.2.0 alone (CDN)', async ({ page }, testInfo) => {
  const { diag } = createDiagnosticCollector();
  const startTime = Date.now();

  page.on('console', (msg) => {
    diag.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() - startTime });
  });
  page.on('pageerror', (err) => {
    diag.pageerrors.push({ message: err.message, stack: err.stack, time: Date.now() - startTime });
  });
  page.on('response', (res) => {
    if (res.url().includes('unpkg') || res.url().endsWith('.js')) {
      diag.scriptResponses.push({
        url: res.url(),
        status: res.status(),
        contentType: res.headers()['content-type'],
        time: Date.now() - startTime,
      });
    }
  });

  await page.goto('/react-cdn-18.2.0.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  fs.writeFileSync(testInfo.outputPath('diagnostic.json'), JSON.stringify({ test: 'react-cdn-18.2.0.html', diag }, null, 2));

  if (diag.pageerrors.length > 0) {
    const err = diag.pageerrors[0];
    console.error('\n╔════════════════════════════════════════╗');
    console.error('║       REACT 18.2.0 ALONE - FAILED       ║');
    console.error('╚════════════════════════════════════════╝');
    console.error(`\nMessage: ${err.message}`);
    if (err.stack) {
      console.error('\nStack (first 20 lines):');
      err.stack.split('\n').slice(0, 20).forEach((line) => console.error(line));
      const urlMatch = err.stack.match(/https?:\/\/[^\s:]+:\d+|file:\/\/[^\s:]+:\d+/);
      if (urlMatch) {
        console.error(`\n🎯 FAILING SCRIPT: ${urlMatch[0]}`);
      }
    }
    console.error(`\nScript responses: ${diag.scriptResponses.length}`);
    diag.scriptResponses.forEach((s) => console.error(`  ${s.status} ${s.url}`));
    throw new Error(`React 18.2.0 failed: ${err.message}`);
  }
});

test('[JS-HEALTH] React+DOM 18.2.0 (CDN)', async ({ page }, testInfo) => {
  const { diag } = createDiagnosticCollector();
  const startTime = Date.now();

  page.on('console', (msg) => {
    diag.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() - startTime });
  });
  page.on('pageerror', (err) => {
    diag.pageerrors.push({ message: err.message, stack: err.stack, time: Date.now() - startTime });
  });
  page.on('response', (res) => {
    if (res.url().includes('unpkg') || res.url().endsWith('.js')) {
      diag.scriptResponses.push({
        url: res.url(),
        status: res.status(),
        contentType: res.headers()['content-type'],
        time: Date.now() - startTime,
      });
    }
  });

  await page.goto('/react-dom-cdn-18.2.0.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  fs.writeFileSync(testInfo.outputPath('diagnostic.json'), JSON.stringify({ test: 'react-dom-cdn-18.2.0.html', diag }, null, 2));

  if (diag.pageerrors.length > 0) {
    const err = diag.pageerrors[0];
    console.error('\n╔════════════════════════════════════════╗');
    console.error('║      REACT+DOM 18.2.0 - FAILED         ║');
    console.error('╚════════════════════════════════════════╝');
    console.error(`\nMessage: ${err.message}`);
    if (err.stack) {
      console.error('\nStack (first 20 lines):');
      err.stack.split('\n').slice(0, 20).forEach((line) => console.error(line));
      const urlMatch = err.stack.match(/https?:\/\/[^\s:]+:\d+|file:\/\/[^\s:]+:\d+/);
      if (urlMatch) {
        console.error(`\n🎯 FAILING SCRIPT: ${urlMatch[0]}`);
      }
    }
    console.error(`\nScript responses: ${diag.scriptResponses.length}`);
    diag.scriptResponses.forEach((s) => console.error(`  ${s.status} ${s.url}`));
    throw new Error(`React+DOM 18.2.0 failed: ${err.message}`);
  }
});

test('[JS-HEALTH] App boot /?boot=bisect&step=0', async ({ page }) => {
  let hasError = false;
  let errorMsg = '';
  let consoleLoaded = false;
  const startTime = Date.now();

  page.on('console', (msg) => {
    diag.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() - startTime });
  });
  page.on('pageerror', (err) => {
    diag.pageerrors.push({ message: err.message, stack: err.stack, time: Date.now() - startTime });
  });
  page.on('response', (res) => {
    if (res.url().endsWith('.js') || res.url().endsWith('.mjs') || res.request().resourceType() === 'script') {
      diag.scriptResponses.push({
        url: res.url(),
        status: res.status(),
        contentType: res.headers()['content-type'],
        time: Date.now() - startTime,
      });
    }
  });

  try {
    console.log('[TEST] Starting page.goto...');
    await page.goto('/?boot=bisect&step=0', { timeout: 15000 });
    console.log('[TEST] page.goto completed');
  } catch (err) {
    console.log('[TEST] page.goto failed:', err);
    diag.pageerrors.push({ message: String(err), stack: String(err), time: Date.now() - startTime });
  }
  console.log('[TEST] Waiting 500ms...');
  await page.waitForTimeout(500);
  console.log('[TEST] Wait completed, writing diagnostics...');
  try {
    fs.writeFileSync(testInfo.outputPath('diagnostic.json'), JSON.stringify({ test: 'app-boot-bisect', diag }, null, 2));
    console.log('[TEST] Diagnostics written successfully');
  } catch (err) {
    console.log('[TEST] Diagnostics write failed:', err);
  }

  if (diag.pageerrors.length > 0) {
    const err = diag.pageerrors[0];
    console.error('\n╔════════════════════════════════════════╗');
    console.error('║         APP BOOT - FAILED              ║');
    console.error('╚════════════════════════════════════════╝');
    console.error(`\nMessage: ${err.message}`);
    if (err.stack) {
      console.error('\nStack (first 20 lines):');
      err.stack.split('\n').slice(0, 20).forEach((line) => console.error(line));
      const urlMatch = err.stack.match(/https?:\/\/[^\s:]+:\d+|file:\/\/[^\s:]+:\d+/);
      if (urlMatch) {
        console.error(`\n🎯 FAILING SCRIPT: ${urlMatch[0]}`);
      }
    }
    console.error(`\nScript responses: ${diag.scriptResponses.length}`);
    diag.scriptResponses.forEach((s) => console.error(`  ${s.status} ${s.url}`));
    console.error(`\nConsole logs: ${diag.consoleLogs.length}`);
    if (diag.consoleLogs.length > 0) {
      console.error('First 10 console lines:');
      diag.consoleLogs.slice(0, 10).forEach((log) => console.error(`  [${log.type}] ${log.text}`));
    }
    throw new Error(`App boot failed: ${err.message}`);
  }
  console.log('[TEST] All checks passed, test complete!');
