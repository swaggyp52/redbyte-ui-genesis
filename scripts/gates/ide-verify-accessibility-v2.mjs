#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE Verify accessibility V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-accessibility-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-check-authority"]', { timeout: 15000 });

  const root = page.locator('[data-testid="ide-mode-verify"]').first();
  assert(await visible(root), 'Verify surface must be visible');

  const accessibleProblems = await page.evaluate(() => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const nameFor = (element) => {
      const ariaLabel = element.getAttribute('aria-label') || '';
      const labelledBy = element.getAttribute('aria-labelledby') || '';
      const labelledText = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ');
      const title = element.getAttribute('title') || '';
      const placeholder = element.getAttribute('placeholder') || '';
      const text = element.textContent || '';
      return [ariaLabel, labelledText, title, placeholder, text].join(' ').replace(/\s+/g, ' ').trim();
    };
    return Array.from(
      document.querySelectorAll(
        '[data-testid="ide-mode-verify"] button, [data-testid="ide-mode-verify"] input, [data-testid="ide-mode-verify"] select, [data-testid="ide-mode-verify"] textarea, [data-testid="ide-mode-verify"] a[href], [data-testid="ide-mode-verify"] [role="button"], [data-testid="ide-mode-verify"] [role="tab"], [data-testid="ide-mode-verify"] [role="menuitem"]'
      )
    )
      .filter((element) => isVisible(element))
      .filter((element) => !nameFor(element))
      .map((element) => ({
        tag: element.tagName,
        role: element.getAttribute('role'),
        testId: element.getAttribute('data-testid'),
        className: element.getAttribute('class'),
      }));
  });
  assert(
    accessibleProblems.length === 0,
    `visible Verify controls need accessible names: ${JSON.stringify(accessibleProblems.slice(0, 12))}`
  );

  const checkAuthority = await page.locator('[data-testid="ide-verify-check-authority"]').first().evaluate((node) => ({
    provenance: node.getAttribute('data-provenance'),
    editable: node.getAttribute('data-editable'),
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  assert(checkAuthority.provenance === 'course', `Course check provenance must be exposed, got ${JSON.stringify(checkAuthority)}`);
  assert(checkAuthority.editable === 'false', `Course checks must expose locked editability, got ${JSON.stringify(checkAuthority)}`);
  assert(/Course checks/i.test(checkAuthority.text), `Course checks must be named in text, got "${checkAuthority.text}"`);

  const lockedCell = page.locator('button[data-testid^="ide-stimulus-expected-"]').first();
  assert(await visible(lockedCell), 'expected-output cell must be visible');
  assert(await lockedCell.isDisabled(), 'course expected-output cell must be disabled');
  const lockedTitle = await lockedCell.getAttribute('title');
  assert(/duplicate/i.test(lockedTitle ?? ''), `locked expected-output cell must explain duplicate path, got "${lockedTitle}"`);

  const duplicate = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  assert(await visible(duplicate), 'Duplicate to My checks must be visible');
  const duplicateName = await duplicate.evaluate((node) =>
    [node.getAttribute('aria-label') || '', node.textContent || '', node.getAttribute('title') || '']
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  assert(/Duplicate to My checks/i.test(duplicateName), `duplicate action needs a meaningful name, got "${duplicateName}"`);

  await page.locator('[data-testid="ide-topbar-help-btn"]').first().click();
  await page.locator('[data-testid="ide-help-diagnostics"]').first().click();
  const dialogInfo = await page.locator('[data-testid="ide-diagnostics-dialog"]').first().evaluate((node) => ({
    role: node.getAttribute('role'),
    modal: node.getAttribute('aria-modal'),
    labelledBy: node.getAttribute('aria-labelledby'),
    hasTitle: Boolean(document.getElementById(node.getAttribute('aria-labelledby') || '')),
  }));
  assert(
    dialogInfo.role === 'dialog' && dialogInfo.modal === 'true' && dialogInfo.hasTitle,
    `Diagnostics dialog must have modal dialog semantics, got ${JSON.stringify(dialogInfo)}`
  );

  assert(
    findings.length === 0,
    `verify accessibility gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
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
