#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE Verify zoom and contrast V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-zoom-contrast-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-check-authority"]', { timeout: 15000 });

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--rb-phase-3f-proof-zoom', '1.25');
    document.body.style.zoom = '1.25';
  });
  await page.waitForTimeout(250);

  const selectors = [
    ['Verify root', '[data-testid="ide-mode-verify"]'],
    ['Run button', '[data-testid="ide-vcb-run"]'],
    ['Check authority', '[data-testid="ide-verify-check-authority"]'],
    ['Stimulus grid', '[data-testid="ide-stimulus-canvas"]'],
    ['Workflow state', '[data-testid="ide-proof-ribbon"]'],
  ];
  for (const [label, selector] of selectors) {
    const locator = page.locator(selector).first();
    assert(await visible(locator), `${label} must remain visible at 125 percent zoom`);
    const box = await locator.boundingBox();
    assert(Boolean(box), `${label} must have a measurable box at 125 percent zoom`);
    assert((box?.width ?? 0) >= 24 && (box?.height ?? 0) >= 16, `${label} is too small at 125 percent zoom: ${JSON.stringify(box)}`);
  }

  const crop = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const results = Array.from(
      document.querySelectorAll(
        '[data-testid="ide-vcb-run"], [data-testid="ide-verify-check-authority"], [data-testid="ide-stimulus-canvas"], [data-testid="ide-proof-ribbon"]'
      )
    ).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        testId: element.getAttribute('data-testid'),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        croppedHorizontally: rect.right < 0 || rect.left > viewportWidth,
        croppedVertically: rect.bottom < 0 || rect.top > viewportHeight,
      };
    });
    return results.filter((entry) => entry.croppedHorizontally || entry.croppedVertically);
  });
  assert(crop.length === 0, `key Verify controls must not be cropped at 125 percent zoom: ${JSON.stringify(crop)}`);

  const contrast = await page.evaluate(() => {
    const targets = [
      ['Run button', '[data-testid="ide-vcb-run"]'],
      ['Check authority', '[data-testid="ide-verify-check-authority"]'],
      ['Workflow status', '[data-testid="ide-proof-ribbon-evidence"]'],
    ];
    return targets.map(([label, selector]) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return { label, selector, missing: true };
      const style = window.getComputedStyle(element);
      const foreground = parseRgb(style.color);
      const background = effectiveBackground(element);
      return {
        label,
        selector,
        foreground: style.color,
        background: background.cssText,
        ratio: foreground && background.rgb ? contrastRatio(foreground, background.rgb) : 0,
      };
    });

    function effectiveBackground(element) {
      let node = element;
      while (node) {
        const style = window.getComputedStyle(node);
        const rgb = parseRgb(style.backgroundColor);
        if (rgb && rgb.a > 0.05) return { rgb, cssText: style.backgroundColor };
        node = node.parentElement;
      }
      return { rgb: { r: 0, g: 0, b: 0, a: 1 }, cssText: 'rgb(0, 0, 0)' };
    }

    function parseRgb(value) {
      const match = /rgba?\(([^)]+)\)/.exec(value);
      if (!match) return null;
      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length >= 4 ? parts[3] : 1 };
    }

    function luminance(channel) {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }

    function contrastRatio(left, right) {
      const l1 = 0.2126 * luminance(left.r) + 0.7152 * luminance(left.g) + 0.0722 * luminance(left.b);
      const l2 = 0.2126 * luminance(right.r) + 0.7152 * luminance(right.g) + 0.0722 * luminance(right.b);
      const light = Math.max(l1, l2);
      const dark = Math.min(l1, l2);
      return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
    }
  });
  const lowContrast = contrast.filter((entry) => entry.missing || entry.ratio < 3);
  assert(lowContrast.length === 0, `core Verify contrast fell below 3:1: ${JSON.stringify(lowContrast)}`);

  assert(
    findings.length === 0,
    `verify zoom/contrast gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

function captureBrowserProblems(page) {
  const findings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      findings.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));
  return findings;
}
