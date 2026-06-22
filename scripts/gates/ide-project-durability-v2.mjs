#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE project durability V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.addInitScript(() => {
    if (window.name === 'rb-phase-3f-project-durability-clean') return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.name = 'rb-phase-3f-project-durability-clean';
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-durability-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  const savedName = 'Phase 3F Durable Lab';
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await visible(title), 'project title rename affordance must be visible before durability save');
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(savedName);
  await page.keyboard.press('Enter');
  try {
    await page.waitForFunction((name) => document.body.innerText.includes(name), savedName, { timeout: 10000 });
  } catch {
    throw new Error(`project rename did not commit before durability save: ${JSON.stringify(await readDurabilityDebug(page))}`);
  }

  try {
    await page.waitForFunction((name) => {
      const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
      if (!runtime?.projectId) return false;
      const runtimeRaw = localStorage.getItem('rb.ide.project-runtime.v1');
      return Boolean(localStorage.getItem(`rb.ide.project.v1:${runtime.projectId}`)) &&
        Boolean(localStorage.getItem('rb.ide.projects.v1.index')) &&
        typeof runtimeRaw === 'string' &&
        runtimeRaw.includes(name);
    }, savedName, { timeout: 10000 });
  } catch {
    throw new Error(`project storage did not flush renamed project before reload: ${JSON.stringify(await readDurabilityDebug(page))}`);
  }

  const beforeReload = await readStorageState(page);
  assert(beforeReload.projectName === savedName, `runtime project name should be saved, got ${JSON.stringify(beforeReload)}`);
  assert(beforeReload.snapshotProjectName === savedName, `snapshot project name should be saved, got ${JSON.stringify(beforeReload)}`);
  assert(beforeReload.indexHasProject, `saved project index must include project id, got ${JSON.stringify(beforeReload)}`);
  assert(beforeReload.rbprojJsonIncludesName, `encoded rbproj snapshot must include project name, got ${JSON.stringify(beforeReload)}`);
  assert(beforeReload.runtimeStatePresent, 'runtime persisted state must exist');
  assert(
    beforeReload.runtimePersistedProjectName === savedName,
    `runtime persisted state must include renamed project before reload, got ${JSON.stringify(beforeReload)}`
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  try {
    await page.waitForFunction((name) => document.body.innerText.includes(name), savedName, { timeout: 10000 });
  } catch {
    throw new Error(`project name did not restore after reload: ${JSON.stringify(await readDurabilityDebug(page))}`);
  }
  const afterReload = await readStorageState(page);
  assert(afterReload.projectName === savedName, `project name must restore after reload, got ${JSON.stringify(afterReload)}`);
  assert(afterReload.nodeCount > 0, `project graph must restore after reload, got ${JSON.stringify(afterReload)}`);

  assert(
    findings.length === 0,
    `project durability gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

async function readStorageState(page) {
  return page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const projectId = runtime?.projectId ?? '';
    const snapshotRaw = projectId ? localStorage.getItem(`rb.ide.project.v1:${projectId}`) : null;
    const indexRaw = localStorage.getItem('rb.ide.projects.v1.index');
    const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : null;
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const runtimeRaw = localStorage.getItem('rb.ide.project-runtime.v1');
    const persistedRuntime = runtimeRaw ? JSON.parse(runtimeRaw) : null;
    return {
      projectId,
      projectName: runtime?.projectName ?? null,
      nodeCount: runtime?.circuit?.nodes?.length ?? 0,
      snapshotProjectName: snapshot?.projectName ?? null,
      rbprojJsonIncludesName: typeof snapshot?.rbprojJson === 'string' && snapshot.rbprojJson.includes(runtime?.projectName ?? ''),
      indexHasProject: Array.isArray(index) && index.some((entry) => entry?.projectId === projectId),
      runtimeStatePresent: Boolean(runtimeRaw),
      runtimePersistedProjectName: persistedRuntime?.state?.projectName ?? null,
    };
  });
}

async function readDurabilityDebug(page) {
  return page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const keys = Object.keys(localStorage).sort();
    const runtimeRaw = localStorage.getItem('rb.ide.project-runtime.v1');
    let runtimeProjectName = null;
    try {
      runtimeProjectName = runtimeRaw ? JSON.parse(runtimeRaw)?.state?.projectName ?? null : null;
    } catch {
      runtimeProjectName = 'unparseable';
    }
    return {
      activeElementTestId: document.activeElement?.getAttribute('data-testid') ?? null,
      bodyHasSavedName: document.body.innerText.includes('Phase 3F Durable Lab'),
      runtimeProjectId: runtime?.projectId ?? null,
      runtimeProjectName: runtime?.projectName ?? null,
      runtimePersistedProjectName: runtimeProjectName,
      storageKeys: keys,
      titleText: document.querySelector('[data-testid="ide-topbar-project-rename"]')?.textContent ?? null,
      inputValue: document.querySelector('[data-testid="ide-topbar-project-name-input"]')?.getAttribute('value') ?? null,
    };
  });
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
