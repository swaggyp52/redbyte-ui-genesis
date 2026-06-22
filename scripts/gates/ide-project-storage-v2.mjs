#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const scenario = parseScenario(process.argv.slice(2));

await runIdeGate(`IDE project storage V2 ${scenario}`, async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);
  await prepareCleanProject(page, baseUrl, scenario);

  if (scenario === 'multitab-conflict') {
    await proveMultitabConflict(page, baseUrl);
  } else if (scenario === 'quota-recovery') {
    await proveQuotaRecovery(page);
  } else if (scenario === 'dirty-update-guard') {
    await proveDirtyUpdateGuard(page);
  } else if (scenario === 'recovery-workflow') {
    await proveRecoveryWorkflow(page);
  } else if (scenario === 'diagnostics-storage') {
    await proveDiagnosticsStorage(page);
  } else if (scenario === 'recovery-accessibility') {
    await proveRecoveryAccessibility(page);
  } else {
    await proveCommittedFacadeState(page);
  }

  const allowed = scenario === 'quota-recovery' || scenario === 'recovery-accessibility'
    ? findings.filter((entry) => !/RedByte project storage save failed: quota/i.test(entry.text))
    : findings;
  assert(allowed.length === 0, `storage gate emitted console/page errors: ${JSON.stringify(allowed.slice(0, 8))}`);
});

async function prepareCleanProject(page, baseUrl, scenarioName) {
  await page.addInitScript((name) => {
    if (window.name === `rb-phase-3h-${name}`) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.name = `rb-phase-3h-${name}`;
  }, scenarioName);

  if (scenarioName === 'quota-recovery' || scenarioName === 'recovery-accessibility') {
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (window.__RB_PHASE_3H_FORCE_QUOTA__ && key === 'rb.ide.project-runtime.v1') {
          const error = new DOMException('Quota exceeded while saving RedByte project.', 'QuotaExceededError');
          throw error;
        }
        return originalSetItem.call(this, key, value);
      };
    });
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-storage-v2-${scenarioName}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await renameProject(page, `Phase 3H ${scenarioName}`);
  await waitForCommittedFacadeState(page);
}

async function proveCommittedFacadeState(page) {
  const state = await readStorageFacadeState(page);
  assert(state.runtimeStatePresent, `runtime key must exist: ${JSON.stringify(state)}`);
  assert(state.journalStatus === 'committed', `journal must be committed: ${JSON.stringify(state)}`);
  assert(state.lastKnownGoodPresent, `last-known-good must exist: ${JSON.stringify(state)}`);
  assert(state.recoveryPointCount >= 1, `recovery point must exist: ${JSON.stringify(state)}`);
  assert(state.runtimeProjectName?.startsWith('Phase 3H'), `runtime name must persist: ${JSON.stringify(state)}`);
}

async function proveRecoveryWorkflow(page) {
  const before = await readStorageFacadeState(page);
  assert(before.lastKnownGoodPresent, `recovery workflow needs last-known-good before corruption: ${JSON.stringify(before)}`);
  await page.evaluate(() => {
    localStorage.setItem('rb.ide.project-runtime.v1', '{"state": {"projectName": ');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  const recovered = await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    return {
      projectName: runtime?.projectName ?? null,
      lastRunStatus: runtime?.verifyLastRun?.status ?? null,
      errorBoundary: Boolean(document.querySelector('[data-testid="ide-error-boundary"]')),
      recoveryStatus: localStorage.getItem('rb.ide.project-runtime.v2.recoveryStatus'),
    };
  });
  assert(!recovered.errorBoundary, `corrupt runtime must not show an error boundary: ${JSON.stringify(recovered)}`);
  assert(String(recovered.projectName ?? '').startsWith('Phase 3H'), `LKG recovery must restore project name: ${JSON.stringify(recovered)}`);
  assert(recovered.lastRunStatus !== 'pass', `recovery must not invent trusted PASS: ${JSON.stringify(recovered)}`);
  assert(/last-known-good/.test(recovered.recoveryStatus ?? ''), `recovery status should cite LKG: ${JSON.stringify(recovered)}`);
}

async function proveMultitabConflict(page, baseUrl) {
  const other = await page.context().newPage();
  try {
    await other.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-storage-v2-conflict-peer`, {
      waitUntil: 'domcontentloaded',
    });
    await other.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await other.evaluate(() => {
      const raw = localStorage.getItem('rb.ide.project-runtime.v1');
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 5 };
      parsed.state = {
        ...(parsed.state ?? {}),
        projectName: 'Phase 3H conflict peer',
      };
      localStorage.setItem('rb.ide.project-runtime.v1', JSON.stringify(parsed));
    });
    const banner = page.locator('[data-testid="ide-storage-conflict-banner"]').first();
    await banner.waitFor({ state: 'visible', timeout: 10000 });
    const text = (await banner.textContent()) ?? '';
    assert(/changed elsewhere|another tab/i.test(text), `conflict banner copy should be clear, got: ${text}`);
  } finally {
    await other.close();
  }
}

async function proveQuotaRecovery(page) {
  await page.evaluate(() => {
    window.__RB_PHASE_3H_FORCE_QUOTA__ = true;
    try {
      window.__RB_PROJECT_RUNTIME__?.getState?.().setProjectIdentity?.({
        projectName: 'Phase 3H quota blocked',
        markDirty: true,
      });
    } catch (error) {
      window.__RB_PHASE_3H_EXPECTED_QUOTA_THROW__ = String(error);
    }
  });
  const banner = page.locator('[data-testid="ide-storage-recovery-banner"]').first();
  await banner.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await banner.textContent()) ?? '';
  assert(/storage is full|backup|retry/i.test(text), `quota recovery banner should be actionable, got: ${text}`);
  assert(await visible(page.locator('button', { hasText: 'Download backup' })), 'quota recovery must offer backup download');
  assert(await visible(page.locator('button', { hasText: 'Retry save' })), 'quota recovery must offer retry');
}

async function proveDirtyUpdateGuard(page) {
  await page.evaluate(() => {
    window.__RB_PROJECT_RUNTIME__?.getState?.().setProjectIdentity?.({
      projectName: 'Phase 3H dirty draft',
      markDirty: true,
    });
  });
  let dialogSeen = false;
  page.once('dialog', async (dialog) => {
    dialogSeen = /leave|changes|reload|site/i.test(dialog.message()) || dialog.type() === 'beforeunload';
    await dialog.accept();
  });
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  assert(dialogSeen, 'dirty update guard should raise a beforeunload confirmation');
}

async function proveDiagnosticsStorage(page) {
  await openDiagnostics(page);
  const bundleRaw = await page.locator('[data-testid="ide-diagnostics-support-bundle"]').first().textContent();
  const bundle = JSON.parse(bundleRaw ?? '{}');
  assert(bundle.storage?.facadeSchemaVersion === 2, `diagnostics must report facade schema: ${bundleRaw}`);
  assert(bundle.storage?.facadeJournalStatus === 'committed', `diagnostics must report committed journal: ${bundleRaw}`);
  assert(bundle.storage?.lastKnownGoodPresent === true, `diagnostics must report LKG: ${bundleRaw}`);
  assert(bundle.storage?.recoveryPointCount >= 1, `diagnostics must report recovery points: ${bundleRaw}`);
}

async function proveRecoveryAccessibility(page) {
  await page.evaluate(() => {
    window.__RB_PHASE_3H_FORCE_QUOTA__ = true;
    try {
      window.__RB_PROJECT_RUNTIME__?.getState?.().setProjectIdentity?.({
        projectName: 'Phase 3H accessible recovery',
        markDirty: true,
      });
    } catch (error) {
      window.__RB_PHASE_3H_EXPECTED_QUOTA_THROW__ = String(error);
    }
  });
  const banner = page.locator('[data-testid="ide-storage-recovery-banner"]').first();
  await banner.waitFor({ state: 'visible', timeout: 10000 });
  assert((await banner.getAttribute('role')) === 'alert', 'recovery warning must be exposed as an alert');
  const labels = await banner.locator('button').evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()));
  assert(labels.includes('Download backup'), `recovery alert needs a named backup action: ${JSON.stringify(labels)}`);
  assert(labels.includes('Retry save'), `recovery alert needs a named retry action: ${JSON.stringify(labels)}`);
  assert(labels.includes('Dismiss'), `recovery alert needs a named dismiss action: ${JSON.stringify(labels)}`);
}

async function openDiagnostics(page) {
  await page.locator('[data-testid="ide-topbar-help-btn"]').first().click();
  await page.locator('[data-testid="ide-help-diagnostics"]').first().click();
  await page.locator('[data-testid="ide-diagnostics-dialog"]').first().waitFor({ state: 'visible', timeout: 5000 });
}

async function renameProject(page, nextName) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  await title.waitFor({ state: 'visible', timeout: 10000 });
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(nextName);
  await page.keyboard.press('Enter');
  await page.waitForFunction((name) => document.body.innerText.includes(name), nextName, { timeout: 10000 });
}

async function waitForCommittedFacadeState(page) {
  try {
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('rb.ide.project-runtime.v1');
      const journalRaw = localStorage.getItem('rb.ide.project-runtime.v2.journal');
      const lkgRaw = localStorage.getItem('rb.ide.project-runtime.v2.lastKnownGood');
      const recoveryCount = Object.keys(localStorage).filter((key) => key.startsWith('rb.ide.project-recovery.v2:')).length;
      if (!raw || !journalRaw || !lkgRaw || recoveryCount < 1) return false;
      try {
        return JSON.parse(journalRaw).status === 'committed';
      } catch {
        return false;
      }
    }, null, { timeout: 12000 });
  } catch (error) {
    throw new Error(`runtime facade state did not commit: ${JSON.stringify(await readStorageFacadeState(page))}; ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readStorageFacadeState(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('rb.ide.project-runtime.v1');
    const journalRaw = localStorage.getItem('rb.ide.project-runtime.v2.journal');
    const lkgRaw = localStorage.getItem('rb.ide.project-runtime.v2.lastKnownGood');
    const recoveryPointCount = Object.keys(localStorage).filter((key) => key.startsWith('rb.ide.project-recovery.v2:')).length;
    let runtimeProjectName = null;
    let journalStatus = null;
    try {
      runtimeProjectName = raw ? JSON.parse(raw)?.state?.projectName ?? null : null;
    } catch {
      runtimeProjectName = 'malformed';
    }
    try {
      journalStatus = journalRaw ? JSON.parse(journalRaw)?.status ?? null : null;
    } catch {
      journalStatus = 'malformed';
    }
    return {
      runtimeStatePresent: Boolean(raw),
      runtimeProjectName,
      journalStatus,
      lastKnownGoodPresent: Boolean(lkgRaw),
      recoveryPointCount,
    };
  });
}

function parseScenario(argv) {
  const arg = argv.find((item) => item.startsWith('--scenario='));
  return arg?.split('=')[1] || 'facade';
}

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
