#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await page.evaluate(() => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (store?.getState) {
        store.getState().reset();
      }
    });
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ide-design-command-header"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ide-design-tool-segmented"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ide-design-empty-state"]', { timeout: 10000 });

    const checklistCount = await page.locator('[data-testid="ide-design-empty-checklist"] li').count();
    assert(checklistCount === 3, `expected three empty-state checklist steps, found ${checklistCount}`);

    const primaryCtaCount = await page
      .locator('[data-testid="ide-design-empty-add-io"], [data-testid="ide-design-empty-add-and"]')
      .count();
    assert(primaryCtaCount === 2, `expected two empty-state primary actions, found ${primaryCtaCount}`);

    const initialSnapshot = await page.evaluate(() => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return null;
      const circuit = store.getState().circuit;
      return { nodes: circuit.nodes.length, wires: circuit.connections.length };
    });
    assert(initialSnapshot, 'circuit store unavailable on window.__RB_CIRCUIT_STORE__');

    await page.locator('[data-testid="ide-design-tool-select"]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'select',
      { timeout: 5000 }
    );
    await page.locator('[data-testid="ide-design-tool-wire"]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'wire',
      { timeout: 5000 }
    );
    const wirePillText = (await page.locator('[data-testid="ide-design-wire-pill"]').first().textContent())?.trim();
    assert(wirePillText === 'Wire Mode', `wire mode pill mismatch: ${wirePillText}`);

    await page.locator('[data-testid="ide-design-add-and-starter"]').click();

    await page.waitForFunction(
      (baseline) => {
        const store = window.__RB_CIRCUIT_STORE__;
        if (!store?.getState) return false;
        return store.getState().circuit.nodes.length >= baseline + 4;
      },
      initialSnapshot.nodes,
      { timeout: 10000 }
    );

    const inputNodes = page.locator('[data-testid^="node-INPUT-"]');
    const andNode = page.locator('[data-testid^="node-AND-"]').first();
    const outputNode = page.locator('[data-testid^="node-OUTPUT-"]').first();

    assert((await inputNodes.count()) >= 2, 'expected at least two INPUT nodes');
    assert((await andNode.count()) === 1, 'expected an AND node');
    assert((await outputNode.count()) === 1, 'expected an OUTPUT node');

    await page.locator('[data-testid="ide-design-tool-wire"]').click();

    await inputNodes.nth(0).locator('[data-port-id="out"]').click();
    await andNode.locator('[data-port-id="in"]').click();

    await andNode.locator('[data-port-id="out"]').click();
    await outputNode.locator('[data-port-id="in"]').click();

    await page.waitForFunction(
      () => {
        const store = window.__RB_CIRCUIT_STORE__;
        if (!store?.getState) return false;
        return store.getState().circuit.connections.length >= 2;
      },
      { timeout: 10000 }
    );

    const finalSnapshot = await page.evaluate(() => {
      const store = window.__RB_CIRCUIT_STORE__;
      const circuit = store?.getState?.().circuit;
      return {
        nodes: circuit?.nodes?.length ?? -1,
        wires: circuit?.connections?.length ?? -1,
        hasCrash: Boolean(document.querySelector('[data-testid="rb-ide-boot-crash"]')),
      };
    });

    assert(finalSnapshot.nodes >= initialSnapshot.nodes + 4, 'node count did not increase as expected');
    assert(finalSnapshot.wires >= 2, 'wire count did not reach expected minimum');
    assert(!finalSnapshot.hasCrash, 'crash marker detected during design flow');
    assert(pageErrors.length === 0, `page errors detected: ${pageErrors.join(' | ')}`);

    console.log('PASS: IDE design build contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE design build contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
