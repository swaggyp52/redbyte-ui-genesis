#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  assert,
  runIdeGate,
  setVerifyRunMode,
  clickVerifyRun,
} from './_gateHarness.mjs';
import {
  assertBuildHash,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const JSZip = loadJsZip();
const runDate = new Date().toISOString().slice(0, 10);
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const juryDateRoot = path.join(repoRoot, '.redbyte', 'proof', 'jury', runDate);
const proofRoot = process.env.REDBYTE_JURY_PROOF_DIR
  ? path.resolve(process.env.REDBYTE_JURY_PROOF_DIR)
  : path.join(juryDateRoot, 'browser-trial', runStamp);
mkdirSync(proofRoot, { recursive: true });
mkdirSync(path.join(repoRoot, '.redbyte-brain', 'jury-runs', runDate), { recursive: true });

const TRIAL_ID = 'jury-half-adder-visible-trial';
const HEAD = git(['rev-parse', 'HEAD']);
const SHORT_HEAD = git(['rev-parse', '--short=9', 'HEAD']);
const BRANCH = git(['branch', '--show-current']);

await runIdeGate('RedByte jury visible Half Adder trial recorded', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const metrics = {
    startedUtc: new Date().toISOString(),
    endedUtc: '',
    elapsedMs: 0,
    clicks: 0,
    scrolls: 0,
    backtracks: 0,
    firstComponentMs: null,
    circuitCompleteMs: null,
    testbenchAuthoredMs: null,
    firstCompareMs: null,
    firstPassMs: null,
    viewport: '1366x768',
  };
  const t0 = Date.now();
  const steps = [];
  const issues = [];
  const screenshots = [];

  const record = (step, status, details = {}) => {
    steps.push({ step, status, atMs: Date.now() - t0, ...details });
    console.log(`[${TRIAL_ID}] ${status} ${step}${details.note ? ` - ${details.note}` : ''}`);
  };

  const capture = async (name) => {
    const fileName = `${String(screenshots.length + 1).padStart(2, '0')}-${safeName(name)}.png`;
    const filePath = path.join(proofRoot, fileName);
    await page.screenshot({ path: filePath, fullPage: true });
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    screenshots.push(relativePath);
    return relativePath;
  };

  const addIssue = async (input) => {
    const evidence = await capture(input.step);
    issues.push({
      id: `JURY-001-${String(issues.length + 1).padStart(2, '0')}`,
      severity: input.severity,
      surface: input.surface,
      step: input.step,
      expected: input.expected,
      actual: input.actual,
      evidence,
      confidence: input.confidence ?? 'high',
      recommendedFix: input.recommendedFix,
    });
    record(input.step, 'OBSTRUCTED', { note: input.actual, severity: input.severity });
  };

  try {
    await page.addInitScript(() => {
      const resetFlag = 'rb-jury-storage-reset-v1';
      if (sessionStorage.getItem(resetFlag) !== '1') {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem(resetFlag, '1');
      }
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=${TRIAL_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await assertBuildHash(page, 'jury Project launch');
    await capture('project-launch');
    record('fresh project launch', 'PASS');

    await renameProject(page, 'Jury Half Adder', metrics);
    record('rename project', 'PASS');

    await clickVisible(page, '[data-testid="ide-project-build-fresh-primary"], [data-testid="ide-project-path-build-fresh"]', 'Build Fresh', metrics);
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await assertBuildHash(page, 'jury Design launch');
    record('open Design from fresh project', 'PASS');

    const placed = await attemptVisibleDesignAuthoring(page, metrics, record, capture);
    if (!placed.ok) {
      await addIssue({
        severity: 'P1',
        surface: 'Design',
        step: placed.step,
        expected: 'A student can place, label, select, undo/redo, and wire A, B, SUM, CARRY, XOR, and AND through visible controls.',
        actual: placed.actual,
        recommendedFix: 'Make from-scratch Half Adder authoring a first-class visible path with direct I/O naming, gate placement, wiring, and undo/redo affordances.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: placed.step });
    }
    metrics.circuitCompleteMs = Date.now() - t0;
    await capture('design-complete');
    record('from-scratch Design circuit', 'PASS');

    const saveReady = await waitForVisibleSaved(page);
    if (!saveReady.ok) {
      await addIssue({
        severity: 'P1',
        surface: 'Design',
        step: 'visible save never settles after Design authoring',
        expected: 'The top-bar save indicator reaches Saved before a student can trust reload or navigation.',
        actual: saveReady.actual,
        recommendedFix: 'Repair autosave completion for visible from-scratch authoring before relying on reload persistence evidence.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: 'Design autosave' });
    }
    record('visible Design autosave settled', 'PASS', saveReady);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    const persisted = await readCircuitSummary(page);
    if (persisted.nodes < 6 || persisted.connections < 6) {
      await addIssue({
        severity: 'P1',
        surface: 'Design',
        step: 'reload persistence after Design',
        expected: 'The authored Half Adder persists across Design reload with at least 6 nodes and 6 wires.',
        actual: `After reload: ${persisted.nodes} nodes and ${persisted.connections} wires.`,
        recommendedFix: 'Repair project persistence for visible authoring mutations before non-draft.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: 'Design reload' });
    }
    record('reload Design persistence', 'PASS', persisted);

    await openMode(page, baseUrl, 'verify', TRIAL_ID);
    const verify = await attemptVisibleVerifyAuthoring(page, metrics, record, capture);
    if (!verify.ok) {
      await addIssue({
        severity: 'P1',
        surface: 'Verify',
        step: verify.step,
        expected: 'A student can create four My checks from scratch, run Compare, see PASS/FAIL, repair, and stale after design edits.',
        actual: verify.actual,
        recommendedFix: 'Make Verify My-check authoring and expected/observed authority obvious and fully operable for a from-scratch circuit.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: verify.step });
    }
    metrics.firstPassMs = Date.now() - t0;
    await capture('verify-pass');
    record('Verify My checks PASS', 'PASS');

    await openMode(page, baseUrl, 'hardware', TRIAL_ID);
    const mapping = await attemptMapping(page, metrics, record, capture);
    if (!mapping.ok) {
      await addIssue({
        severity: 'P1',
        surface: 'Map Pins',
        step: mapping.step,
        expected: 'A student can map A->SW0, B->SW1, SUM->LED0, CARRY->LED1 with visible row-to-board linking.',
        actual: mapping.actual,
        recommendedFix: 'Make from-scratch signal rows and Basys3 resource assignment deterministic and discoverable.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: mapping.step });
    }
    await capture('hardware-mapped');
    record('Map Pins row-to-board linking', 'PASS');

    await openMode(page, baseUrl, 'verify', TRIAL_ID);
    if (!(await setVerifyRunMode(page, 'compare'))) {
      await addIssue({
        severity: 'P1',
        surface: 'Verify',
        step: 'post-map Compare unavailable',
        expected: 'After Map Pins changes, a student can rerun Compare before trusted Export inspection.',
        actual: 'Compare mode was not selectable after returning from Map Pins.',
        recommendedFix: 'Keep Verify Compare reachable after Map Pins so Export trust can be restored without hidden state changes.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: 'post-map Compare unavailable' });
    }
    await clickVerifyRun(page);
    await waitForVerifyResult(page, { timeout: 20000 });
    const postMapStatus = await readVerifyStatus(page);
    if (!/pass/i.test(postMapStatus)) {
      await addIssue({
        severity: 'P1',
        surface: 'Verify',
        step: 'post-map Verify PASS',
        expected: 'After Map Pins changes, rerunning Compare restores current PASS before trusted Export inspection.',
        actual: `Expected current PASS after Map Pins rerun, got "${postMapStatus}".`,
        recommendedFix: 'Repair Verify invalidation/recovery around Map Pins so the trusted Export handoff can be re-established visibly.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: 'post-map Verify PASS' });
    }
    await capture('verify-post-map-pass');
    record('post-map Verify PASS', 'PASS');

    await openMode(page, baseUrl, 'export', TRIAL_ID);
    const exported = await attemptExportInspection(page, metrics, record, capture);
    if (!exported.ok) {
      await addIssue({
        severity: 'P1',
        surface: 'Export',
        step: exported.step,
        expected: 'A student can inspect VHDL, XDC, testbench, Vivado Tcl, README, and download the package.',
        actual: exported.actual,
        recommendedFix: 'Make export artifact inspection and download available after visible from-scratch completion without overclaiming hardware proof.',
      });
      return writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: exported.step });
    }
    await capture('export-inspected');
    record('Export trusted package inspection', 'PASS', {
      trustTier: exported.trustTier,
      suggestedFilename: exported.suggestedFilename,
      packageManifest: exported.packageManifest,
      downloadedZip: exported.downloadedZip,
    });

    await openMode(page, baseUrl, 'project', TRIAL_ID);
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
    metrics.backtracks += 1;
    await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => null);
    metrics.backtracks += 1;
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await assertBuildHash(page, 'jury back-forward');
    await capture('project-back-forward');
    record('Project reload/back-forward resume', 'PASS');

    writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'READY_FOR_JURY_DELIBERATION' });
  } catch (error) {
    issues.push({
      id: `JURY-001-${String(issues.length + 1).padStart(2, '0')}`,
      severity: 'P1',
      surface: 'Trial harness',
      step: 'unexpected browser trial error',
      expected: 'The jury trial completes or records a product obstruction.',
      actual: error instanceof Error ? error.message : String(error),
      evidence: await capture('unexpected-trial-error').catch(() => null),
      confidence: 'medium',
      recommendedFix: 'Inspect the harness and visible product path before relying on this trial.',
    });
    writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status: 'NOT_READY', stopAt: 'unexpected browser trial error' });
  }
});

async function attemptVisibleDesignAuthoring(page, metrics, record) {
  const placements = [
    { type: 'INPUT', testId: 'ide-design-palette-input', label: 'A', x: 220, y: 220 },
    { type: 'INPUT', testId: 'ide-design-palette-input', label: 'B', x: 220, y: 380 },
    { type: 'OUTPUT', testId: 'ide-design-palette-output', label: 'SUM', x: 640, y: 220 },
    { type: 'OUTPUT', testId: 'ide-design-palette-output', label: 'CARRY', x: 640, y: 380 },
    { type: 'XOR', testId: 'ide-design-palette-xor', label: 'XOR', x: 420, y: 220 },
    { type: 'AND', testId: 'ide-design-palette-and', label: 'AND', x: 420, y: 380 },
  ];

  for (const item of placements) {
    const before = await readCircuitSummary(page);
    const placed = await placeNodeFromPalette(page, item, metrics);
    if (!placed.ok) return placed;
    await page.waitForFunction((count) => {
      const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
      return nodes.length > count;
    }, before.nodes, { timeout: 8000 }).catch(() => null);
    if (metrics.firstComponentMs == null) metrics.firstComponentMs = elapsedFrom(metrics);
    const node = await findNewestNode(page, item.type, before.nodeIds);
    if (!node) {
      return { ok: false, step: `place ${item.label}`, actual: `Placed ${item.type}, but no new visible runtime node was detected.` };
    }
    const renamed = await renameSelectedNode(page, node.id, item.label, metrics);
    if (!renamed.ok) return renamed;
    record(`place and label ${item.label}`, 'PASS', { nodeId: node.id });
  }

  const beforeUndo = await readCircuitSummary(page);
  await placeNodeFromPalette(page, { type: 'OR', testId: 'ide-design-palette-or', label: 'OR_TEMP', x: 340, y: 300 }, metrics);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await page.waitForTimeout(250);
  const afterUndo = await readCircuitSummary(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Y' : 'Control+Y');
  await page.waitForTimeout(250);
  const afterRedo = await readCircuitSummary(page);
  if (afterUndo.nodes !== beforeUndo.nodes || afterRedo.nodes !== beforeUndo.nodes + 1) {
    return { ok: false, step: 'undo/redo visible authoring', actual: `Undo/redo counts were before ${beforeUndo.nodes}, undo ${afterUndo.nodes}, redo ${afterRedo.nodes}.` };
  }
  await deleteNewestNode(page, 'OR', metrics).catch(() => null);
  record('undo/redo authoring', 'PASS');

  const labels = await readNodesByLabel(page);
  const required = ['A', 'B', 'SUM', 'CARRY', 'XOR', 'AND'];
  for (const label of required) {
    if (!labels[label]) return { ok: false, step: 'resolve labeled nodes', actual: `Could not resolve node label ${label} after visible placement.` };
  }

  await clickVisible(page, '[data-testid="ide-design-tool-wire"], [data-testid="ide-design-quick-wire"]', 'Wire tool', metrics);
  const wires = [
    ['A', 'out', 'XOR', 'a'],
    ['B', 'out', 'XOR', 'b'],
    ['A', 'out', 'AND', 'a'],
    ['B', 'out', 'AND', 'b'],
    ['XOR', 'out', 'SUM', 'in'],
    ['AND', 'out', 'CARRY', 'in'],
  ];
  for (const [fromLabel, fromPort, toLabel, toPort] of wires) {
    const result = await wirePorts(page, labels[fromLabel], fromPort, labels[toLabel], toPort, metrics);
    if (!result.ok) return { ok: false, step: `wire ${fromLabel}.${fromPort} to ${toLabel}.${toPort}`, actual: result.actual };
    record(`wire ${fromLabel} to ${toLabel}`, 'PASS');
  }

  const summary = await readCircuitSummary(page);
  if (summary.connections < 6) {
    return { ok: false, step: 'complete Half Adder wiring', actual: `Expected at least 6 wires, got ${summary.connections}.` };
  }
  return { ok: true };
}

async function attemptVisibleVerifyAuthoring(page, metrics, record, capture) {
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await clickIfVisible(page, '[data-testid="ide-stimulus-add-tick"]', metrics);
  await clickIfVisible(page, '[data-testid="ide-stimulus-add-tick"]', metrics);
  await clickIfVisible(page, '[data-testid="ide-stimulus-add-tick"]', metrics);
  await clickIfVisible(page, '[data-testid="ide-stimulus-add-tick"]', metrics);
  await page.waitForTimeout(250);

  const stimulus = await readStimulusSelectors(page);
  if (stimulus.inputLabels.length < 2 || stimulus.outputLabels.length < 2 || stimulus.ticks.length < 4) {
    return {
      ok: false,
      step: 'author My checks from scratch',
      actual: `Stimulus canvas did not expose 2 inputs, 2 outputs, and 4 cases. Snapshot: ${JSON.stringify(stimulus)}`,
    };
  }

  const inputA = matchByLabel(stimulus.inputs, 'A');
  const inputB = matchByLabel(stimulus.inputs, 'B');
  const outputSum = matchByLabel(stimulus.outputs, 'SUM');
  const outputCarry = matchByLabel(stimulus.outputs, 'CARRY');
  if (!inputA || !inputB || !outputSum || !outputCarry) {
    return {
      ok: false,
      step: 'match Verify rows to circuit labels',
      actual: `Could not match A/B/SUM/CARRY in Verify. Snapshot: ${JSON.stringify(stimulus)}`,
    };
  }

  const cases = [
    { tick: stimulus.ticks[0], a: 0, b: 0, sum: 0, carry: 0 },
    { tick: stimulus.ticks[1], a: 0, b: 1, sum: 1, carry: 0 },
    { tick: stimulus.ticks[2], a: 1, b: 0, sum: 1, carry: 0 },
    { tick: stimulus.ticks[3], a: 1, b: 1, sum: 0, carry: 1 },
  ];
  for (const entry of cases) {
    await setInputCell(page, inputA.id, entry.tick, entry.a, metrics);
    await setInputCell(page, inputB.id, entry.tick, entry.b, metrics);
    await setExpectedCell(page, outputSum.id, entry.tick, entry.sum, metrics);
    await setExpectedCell(page, outputCarry.id, entry.tick, entry.carry, metrics);
  }
  metrics.testbenchAuthoredMs = elapsedFrom(metrics);
  record('author four My checks', 'PASS');

  if (!(await setVerifyRunMode(page, 'compare'))) {
    return { ok: false, step: 'select Compare mode', actual: 'Compare mode was not selectable after authoring expected outputs.' };
  }
  metrics.firstCompareMs = elapsedFrom(metrics);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const status = await readVerifyStatus(page);
  if (!/pass/i.test(status)) {
    return { ok: false, step: 'first Compare PASS', actual: `Expected PASS for authored Half Adder checks, got "${status}".` };
  }

  await setExpectedCell(page, outputSum.id, cases[0].tick, 1, metrics);
  if (!(await setVerifyRunMode(page, 'compare'))) return { ok: false, step: 'run intentional FAIL', actual: 'Compare mode unavailable after expected edit.' };
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const failStatus = await readVerifyStatus(page);
  if (!/fail/i.test(failStatus)) {
    return { ok: false, step: 'intentional FAIL', actual: `Edited expected output should FAIL, got "${failStatus}".` };
  }
  await capture('verify-intentional-fail');
  record('intentional Verify FAIL', 'PASS');

  await setExpectedCell(page, outputSum.id, cases[0].tick, 0, metrics);
  if (!(await setVerifyRunMode(page, 'compare'))) return { ok: false, step: 'repair expected output', actual: 'Compare mode unavailable after repair.' };
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const repairedStatus = await readVerifyStatus(page);
  if (!/pass/i.test(repairedStatus)) {
    return { ok: false, step: 'repair to PASS', actual: `Repaired expected output should PASS, got "${repairedStatus}".` };
  }
  await capture('verify-repaired-pass');
  record('repair Verify PASS', 'PASS');

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const labels = await readNodesByLabel(page);
  await renameSelectedNode(page, labels.XOR, 'XOR_EDITED', metrics);
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  const authority = await page.locator('[data-testid="ide-verify-v2-authority"]').first().getAttribute('data-result-status').catch(() => '');
  if (authority !== 'stale') {
    return { ok: false, step: 'stale after design edit', actual: `Expected stale authority after design edit, got "${authority || 'missing'}".` };
  }
  await capture('verify-stale-after-design-edit');
  record('design edit invalidates PASS as stale', 'PASS');
  if (!(await setVerifyRunMode(page, 'compare'))) {
    return { ok: false, step: 'restore current PASS after stale edit', actual: 'Compare mode unavailable after stale design edit.' };
  }
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const finalStatus = await readVerifyStatus(page);
  if (!/pass/i.test(finalStatus)) {
    return { ok: false, step: 'restore current PASS after stale edit', actual: `Expected current PASS after rerunning Compare, got "${finalStatus}".` };
  }
  await capture('verify-post-stale-rerun-pass');
  record('rerun Verify after stale edit returns PASS', 'PASS');
  return { ok: true };
}

async function attemptMapping(page, metrics) {
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 15000 });
  const targets = [
    { label: 'A', alias: 'SW0', boardSelector: '[data-testid="ide-hw-map-sw-0-hit"], [data-testid="ide-hw-map-sw-0"]' },
    { label: 'B', alias: 'SW1', boardSelector: '[data-testid="ide-hw-map-sw-1-hit"], [data-testid="ide-hw-map-sw-1"]' },
    { label: 'SUM', alias: 'LD0', boardSelector: '[data-testid="ide-hw-map-ld-0-hit"], [data-testid="ide-hw-map-ld-0"]' },
    { label: 'CARRY', alias: 'LD1', boardSelector: '[data-testid="ide-hw-map-ld-1-hit"], [data-testid="ide-hw-map-ld-1"]' },
  ];
  for (const { label, alias, boardSelector } of targets) {
    const rowSelector = await findMapRowForLabel(page, label);
    if (!rowSelector) {
      return { ok: false, step: `map ${label}`, actual: `No visible Map Pins row for ${label}. Rows: ${JSON.stringify(await readMappingState(page))}` };
    }
    await clickVisible(page, rowSelector, `map row ${label}`, metrics);
    const selected = await waitForMapRowSelected(page, label);
    if (!selected.ok) {
      return { ok: false, step: `select map row ${label}`, actual: selected.actual };
    }
    await clickVisible(page, boardSelector, `board resource for ${label}`, metrics);
    const mapped = await waitForMappingAlias(page, label, alias);
    if (!mapped.ok) {
      return { ok: false, step: `map ${label} to ${alias}`, actual: mapped.actual };
    }
  }
  const summary = await readMappingState(page);
  const missing = summary.runtimeRows.filter((row) => row.required && !row.pin);
  if (missing.length > 0) {
    return { ok: false, step: 'complete Map Pins', actual: `Required rows still missing pins: ${JSON.stringify(missing)}. Visible rows: ${JSON.stringify(summary.domRows)}` };
  }
  for (const { label, alias } of targets) {
    const row = summary.runtimeRows.find((candidate) => normalize(candidate.label) === normalize(label));
    if (!row || normalize(row.pin) !== normalize(alias)) {
      return { ok: false, step: `assert ${label} mapped to ${alias}`, actual: `Expected ${label}->${alias}; mapping summary: ${JSON.stringify(summary)}` };
    }
  }
  return { ok: true };
}

async function attemptExportInspection(page, metrics) {
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 15000 });
  const panelText = ((await page.locator('[data-testid="ide-export-panel"]').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  if (/export blocked|package blocked/i.test(panelText)) {
    return { ok: false, step: 'Export readiness', actual: `Export still reports blocked: ${panelText.slice(0, 500)}` };
  }
  const handoffText = ((await page.locator('[data-testid="ide-export-handoff-checklist-v1"]').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  if (!/4\/4\s*mapped/i.test(handoffText)) {
    return { ok: false, step: 'Export pin handoff', actual: `Export did not show 4/4 mapped. Handoff: ${handoffText}` };
  }
  const trustState = await readExportTrustState(page);
  if (trustState.trustTier !== 'trusted-browser-package') {
    return {
      ok: false,
      step: 'Export trust tier',
      actual: `Expected trusted browser package after post-map Compare rerun, got ${JSON.stringify(trustState)}`,
    };
  }
  const artifacts = await page.locator('[data-testid^="ide-export-artifact-tab-"], [data-testid^="ide-export-file-"]').evaluateAll((elements) =>
    elements.map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase())
  ).catch(() => []);
  const required = ['top.vhd', 'top.xdc', 'testbench.vhd', 'vivado_import.tcl', 'readme'];
  for (const item of required) {
    if (!artifacts.some((artifact) => artifact.includes(item))) {
      return { ok: false, step: `inspect export ${item}`, actual: `Artifact tab missing ${item}. Visible artifacts: ${artifacts.join(', ')}` };
    }
    if (!artifacts.some((artifact) => artifact.includes(item) && artifact.includes('ready'))) {
      return { ok: false, step: `inspect export ${item}`, actual: `Artifact ${item} was not visibly Ready. Visible artifacts: ${artifacts.join(', ')}` };
    }
  }
  const download = page.locator('[data-testid="ide-export-dock-download"], [data-testid="ide-export-package-download-v1"], [data-testid="ide-export-download-kit-btn"]').first();
  if (!(await download.isVisible().catch(() => false))) {
    return { ok: false, step: 'download export package', actual: 'No visible package download action was available.' };
  }
  if (await download.isDisabled().catch(() => true)) {
    return { ok: false, step: 'download export package', actual: 'Package download action was visible but disabled.' };
  }
  await page.locator('[data-testid="ide-export-file-top-vhd"]').first().click();
  const preview = ((await page.locator('[data-testid="ide-export-preview-code"]').first().textContent().catch(() => '')) ?? '').trim();
  const hasGeneratedVhdl =
    /library\s+ieee/i.test(preview) &&
    /std_logic/i.test(preview) &&
    /entity\s+[a-z_][a-z0-9_]*/i.test(preview) &&
    /architecture\s+[a-z_][a-z0-9_]*\s+of\s+[a-z_][a-z0-9_]*/i.test(preview);
  if (!hasGeneratedVhdl) {
    return { ok: false, step: 'preview top.vhd', actual: `top.vhd preview did not contain generated VHDL structure. Preview starts: ${preview.slice(0, 160)}` };
  }
  metrics.clicks += 1;
  const downloadEvent = page.waitForEvent('download', { timeout: 20000 });
  await download.click();
  const downloaded = await downloadEvent.catch((error) => error);
  if (downloaded instanceof Error) {
    return { ok: false, step: 'download export package', actual: `Clicking enabled download did not produce a download: ${downloaded.message}` };
  }
  const failure = await downloaded.failure();
  if (failure) {
    return { ok: false, step: 'download export package', actual: `Browser reported download failure: ${failure}` };
  }
  const suggestedFilename = downloaded.suggestedFilename?.() ?? 'redbyte-export.zip';
  const downloadRoot = path.join(proofRoot, 'downloaded-package');
  mkdirSync(downloadRoot, { recursive: true });
  const zipPath = path.join(downloadRoot, suggestedFilename);
  await downloaded.saveAs(zipPath);
  let packageManifest;
  try {
    packageManifest = await inspectDownloadedZip(zipPath);
  } catch (error) {
    return {
      ok: false,
      step: 'inspect downloaded ZIP',
      actual: error instanceof Error ? error.message : String(error),
    };
  }
  const manifestPath = path.join(downloadRoot, 'zip-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(packageManifest, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    trustTier: trustState.trustTier,
    suggestedFilename,
    downloadedZip: path.relative(repoRoot, zipPath).replace(/\\/g, '/'),
    packageManifest: path.relative(repoRoot, manifestPath).replace(/\\/g, '/'),
  };
}

async function readExportTrustState(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
    const panel = normalize(document.querySelector('[data-testid="ide-export-panel"]')?.textContent);
    const checklist = normalize(document.querySelector('[data-testid="ide-export-handoff-checklist-v1"]')?.textContent);
    const commandStrip = normalize(document.querySelector('[data-testid="ide-export-command-strip"]')?.textContent);
    const handoffContract = `${checklist} ${commandStrip}`;
    const isDraft = /needs review|stale|package partial|draft workspace/i.test(handoffContract);
    const isTrusted =
      /package\s*ready to build|ready to build/i.test(handoffContract) &&
      /compare\s*pass|checks match/i.test(handoffContract) &&
      /4\/4\s*mapped/i.test(handoffContract);
    return {
      panel,
      checklist,
      commandStrip,
      trustTier: isDraft ? 'draft-or-stale-package' : isTrusted ? 'trusted-browser-package' : 'unknown',
    };
  });
}

async function inspectDownloadedZip(zipPath) {
  const zipBuffer = readFileSync(zipPath);
  const zipHash = sha256(zipBuffer);
  const zip = await JSZip.loadAsync(zipBuffer);
  const entries = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const content = await entry.async('nodebuffer');
    entries.push({
      path: entry.name,
      basename: path.basename(entry.name).toLowerCase(),
      bytes: content.length,
      sha256: sha256(content),
    });
  }

  const required = ['top.vhd', 'top.xdc', 'testbench.vhd', 'vivado_import.tcl', 'readme.txt'];
  const byBasename = new Map(entries.map((entry) => [entry.basename, entry]));
  const missing = required.filter((name) => !byBasename.has(name));
  if (missing.length > 0) {
    throw new Error(`Downloaded ZIP is missing required files: ${missing.join(', ')}. Entries: ${entries.map((entry) => entry.path).join(', ')}`);
  }

  const readText = async (basename) => {
    const entry = Object.values(zip.files).find((candidate) => !candidate.dir && path.basename(candidate.name).toLowerCase() === basename);
    return entry ? await entry.async('string') : '';
  };

  const xdc = await readText('top.xdc');
  const missingPins = ['V17', 'V16', 'U16', 'E19'].filter((pin) => !new RegExp(`\\b${pin}\\b`, 'i').test(xdc));
  if (missingPins.length > 0) {
    throw new Error(`top.xdc is missing expected Basys3 package pins: ${missingPins.join(', ')}`);
  }
  const lvcmosCount = (xdc.match(/LVCMOS33/gi) ?? []).length;
  if (lvcmosCount < 4) {
    throw new Error(`top.xdc should contain at least four LVCMOS33 constraints, found ${lvcmosCount}.`);
  }

  const topVhd = await readText('top.vhd');
  const testbench = await readText('testbench.vhd');
  const tcl = await readText('vivado_import.tcl');
  const readme = await readText('readme.txt');
  if (!/library\s+ieee/i.test(topVhd) || !/architecture/i.test(topVhd)) {
    throw new Error('top.vhd in the downloaded ZIP did not contain generated VHDL structure.');
  }
  if (!/assert|expected|stimulus|testbench/i.test(testbench)) {
    throw new Error('testbench.vhd did not contain recognizable testbench or expected/stimulus content.');
  }
  if (!/create_project|Vivado/i.test(tcl)) {
    throw new Error('vivado_import.tcl did not contain recognizable Vivado project setup.');
  }
  if (!/Vivado/i.test(readme) || !/Basys3|bitstream|program|hardware|board/i.test(readme)) {
    throw new Error('README.txt did not contain recognizable downstream Vivado/Basys3 handoff language.');
  }

  return {
    zipPath: path.relative(repoRoot, zipPath).replace(/\\/g, '/'),
    bytes: zipBuffer.length,
    sha256: zipHash,
    entries,
    assertions: {
      requiredFiles: required,
      basys3PackagePins: ['V17', 'V16', 'U16', 'E19'],
      lvcmos33Constraints: lvcmosCount,
      noVivadoOrBasys3ExecutionClaimed: true,
    },
    excerpts: {
      topVhd: excerpt(topVhd),
      topXdc: excerpt(xdc),
      testbench: excerpt(testbench),
      vivadoImportTcl: excerpt(tcl),
      readme: excerpt(readme),
    },
  };
}

async function renameProject(page, name, metrics) {
  await clickVisible(page, '[data-testid="ide-topbar-project-rename"]', 'project name', metrics, { dblclick: true });
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
}

async function placeNodeFromPalette(page, item, metrics) {
  const palette = page.locator(`[data-testid="${item.testId}"]`).first();
  if (!(await palette.isVisible().catch(() => false))) {
    await page.locator('[data-testid="ide-design-search"]').first().fill(item.type).catch(() => null);
  }
  if (!(await palette.isVisible().catch(() => false))) {
    return { ok: false, step: `place ${item.label}`, actual: `Palette control ${item.testId} is not visible.` };
  }
  await palette.scrollIntoViewIfNeeded().catch(() => null);
  metrics.clicks += 1;
  await palette.click({ force: true });
  await page.waitForFunction(() => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1', null, { timeout: 5000 }).catch(() => null);
  await clickCanvasAt(page, item.x, item.y, metrics);
  return { ok: true };
}

async function clickCanvasAt(page, x, y, metrics) {
  const rect = await page.locator('[data-testid="ide-design-live-canvas"]').first().boundingBox();
  assert(rect, 'Design canvas bounding box missing');
  metrics.clicks += 1;
  await page.mouse.click(rect.x + x, rect.y + y);
  await page.waitForTimeout(180);
}

async function renameSelectedNode(page, nodeId, label, metrics) {
  const node = page.locator(`[data-node-id="${cssEscape(nodeId)}"]`).first();
  if (!(await node.isVisible().catch(() => false))) return { ok: false, step: `rename ${label}`, actual: `Node ${nodeId} is not visible.` };
  metrics.clicks += 1;
  await node.click({ force: true });
  await page.waitForTimeout(120);
  const rename = page.locator('[data-testid="ide-design-context-rename"], [data-testid="ide-design-label-edit-btn"]').first();
  if (!(await rename.isVisible().catch(() => false))) return { ok: false, step: `rename ${label}`, actual: 'Visible Rename/Add label control was not available after node selection.' };
  metrics.clicks += 1;
  await rename.click({ force: true });
  const input = page.locator('[data-testid="ide-design-label-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(label);
  await input.press('Enter');
  await page.waitForTimeout(160);
  return { ok: true };
}

async function wirePorts(page, fromNodeId, fromPort, toNodeId, toPort, metrics) {
  const before = await readCircuitSummary(page);
  const first = page.locator(`[data-node-id="${cssEscape(fromNodeId)}"] [data-port-id="${cssEscape(fromPort)}"]`).first();
  const second = page.locator(`[data-node-id="${cssEscape(toNodeId)}"] [data-port-id="${cssEscape(toPort)}"]`).first();
  if (!(await first.isVisible().catch(() => false))) return { ok: false, actual: `Source port ${fromNodeId}.${fromPort} not visible.` };
  if (!(await second.isVisible().catch(() => false))) return { ok: false, actual: `Destination port ${toNodeId}.${toPort} not visible.` };
  metrics.clicks += 2;
  await clickElementCenter(page, first);
  await page.waitForTimeout(120);
  await clickElementCenter(page, second);
  await page.waitForFunction((count) => {
    const connections = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections ?? [];
    return connections.length > count;
  }, before.connections, { timeout: 5000 }).catch(() => null);
  const after = await readCircuitSummary(page);
  return after.connections > before.connections
    ? { ok: true }
    : { ok: false, actual: `Clicking visible ports did not add a wire; connections stayed at ${after.connections}.` };
}

async function setInputCell(page, fieldId, tick, value, metrics) {
  const selector = `[data-testid="ide-stimulus-cell-${cssEscape(fieldId)}-t${tick}"]`;
  const current = await readCellBinary(page, selector);
  if (current === value) return;
  await clickVisible(page, selector, `input ${fieldId} t${tick}`, metrics);
}

async function setExpectedCell(page, fieldId, tick, value, metrics) {
  const selector = `[data-testid="ide-stimulus-expected-${cssEscape(fieldId)}-t${tick}"]`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellBinary(page, selector);
    if (current === value) return;
    await clickVisible(page, selector, `expected ${fieldId} t${tick}`, metrics);
    await page.waitForTimeout(80);
  }
}

async function readCellBinary(page, selector) {
  const title = await page.locator(selector).first().getAttribute('title').catch(() => '');
  if (/:\s*1\b/.test(title ?? '')) return 1;
  if (/:\s*0\b/.test(title ?? '')) return 0;
  return null;
}

async function clickVisible(page, selector, label, metrics, options = {}) {
  const target = page.locator(selector).first();
  if (!(await target.isVisible().catch(() => false))) throw new Error(`${label}: ${selector} not visible`);
  await target.scrollIntoViewIfNeeded().catch(() => null);
  metrics.clicks += 1;
  if (options.dblclick) await target.dblclick({ force: true });
  else await target.click({ force: true });
  await page.waitForTimeout(120);
}

async function clickIfVisible(page, selector, metrics) {
  const target = page.locator(selector).first();
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => null);
  metrics.clicks += 1;
  await target.click({ force: true });
  await page.waitForTimeout(80);
  return true;
}

async function clickElementCenter(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('target bounding box missing');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function readCircuitSummary(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ?? { nodes: [], connections: [] };
    return {
      nodes: circuit.nodes.length,
      connections: circuit.connections.length,
      nodeIds: circuit.nodes.map((node) => node.id),
    };
  });
}

async function findNewestNode(page, type, previousNodeIds) {
  return page.evaluate(({ type, previousNodeIds }) => {
    const previous = new Set(previousNodeIds);
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
    return [...nodes].reverse().find((node) => node.type === type && !previous.has(node.id)) ?? null;
  }, { type, previousNodeIds });
}

async function deleteNewestNode(page, type, metrics) {
  const node = await page.evaluate((type) => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
    return [...nodes].reverse().find((candidate) => candidate.type === type) ?? null;
  }, type);
  if (!node) return;
  metrics.clicks += 1;
  await page.locator(`[data-node-id="${cssEscape(node.id)}"]`).first().click({ force: true });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(160);
}

async function readNodesByLabel(page) {
  return page.evaluate(() => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
    return Object.fromEntries(nodes.map((node) => [String(node.label ?? node.type).trim(), node.id]));
  });
}

async function readStimulusSelectors(page) {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('button[data-testid^="ide-stimulus-cell-"]')).map((button) => {
      const testId = button.getAttribute('data-testid') ?? '';
      const title = button.getAttribute('title') ?? '';
      const match = /^ide-stimulus-cell-(.+)-t(\d+)$/.exec(testId);
      const label = title.split(' in ')[0] ?? '';
      return { id: match?.[1] ?? '', tick: Number(match?.[2] ?? 0), label, title };
    }).filter((entry) => entry.id);
    const outputs = Array.from(document.querySelectorAll('button[data-testid^="ide-stimulus-expected-"]')).map((button) => {
      const testId = button.getAttribute('data-testid') ?? '';
      const title = button.getAttribute('title') ?? '';
      const match = /^ide-stimulus-expected-(.+)-t(\d+)$/.exec(testId);
      const label = title.split(' in ')[0] ?? '';
      return { id: match?.[1] ?? '', tick: Number(match?.[2] ?? 0), label, title, disabled: button.disabled };
    }).filter((entry) => entry.id);
    return {
      inputs,
      outputs,
      inputLabels: [...new Set(inputs.map((entry) => entry.label))],
      outputLabels: [...new Set(outputs.map((entry) => entry.label))],
      ticks: [...new Set([...inputs, ...outputs].map((entry) => entry.tick))].sort((a, b) => a - b),
    };
  });
}

function matchByLabel(entries, expected) {
  return entries.find((entry) => normalize(entry.label) === normalize(expected)) ?? null;
}

async function readVerifyStatus(page) {
  const authority = await page.locator('[data-testid="ide-verify-v2-authority"]').first().getAttribute('data-result-status').catch(() => '');
  const summary = await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '');
  return authority || summary || '';
}

async function findMapRowForLabel(page, label) {
  return page.evaluate((label) => {
    const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    const wanted = normalize(label);
    const rows = Array.from(document.querySelectorAll('button[data-testid^="ide-hw-map-row-"]'));
    const row = rows.find((candidate) => {
      const testId = candidate.getAttribute('data-testid') ?? '';
      const rowId = testId.replace(/^ide-hw-map-row-/, '');
      const signal = document.querySelector(`[data-testid="ide-hw-map-row-signal-${rowId}"]`);
      const labelNode = signal?.querySelector('.ide-hw-map-row-label');
      return normalize(labelNode?.textContent) === wanted;
    });
    const testId = row?.getAttribute('data-testid');
    return testId ? `[data-testid="${testId}"]` : null;
  }, label);
}

async function waitForMappingAlias(page, label, alias) {
  const ok = await page
    .waitForFunction(
      ({ label, alias }) => {
        const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
        const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [];
        const row = rows.find((candidate) => normalize(candidate.label) === normalize(label));
        return Boolean(row && normalize(row.pin) === normalize(alias));
      },
      { label, alias },
      { timeout: 6000 }
    )
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    return {
      ok: false,
      actual: `Expected ${label} to map to ${alias}; current mapping state: ${JSON.stringify(await readMappingState(page))}`,
    };
  }

  const rowSelector = await findMapRowForLabel(page, label);
  const rowText = rowSelector
    ? ((await page.locator(rowSelector).first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim()
    : '';
  if (!new RegExp(`\\b${alias}\\b`, 'i').test(rowText) || /missing/i.test(rowText)) {
    return {
      ok: false,
      actual: `Runtime mapped ${label} to ${alias}, but visible row did not show the completed binding. Row text: ${rowText}`,
    };
  }
  return { ok: true };
}

async function waitForMapRowSelected(page, label) {
  const rowSelector = await findMapRowForLabel(page, label);
  if (!rowSelector) {
    return { ok: false, actual: `No row selector for ${label}. State: ${JSON.stringify(await readMappingState(page))}` };
  }
  const selected = await page
    .waitForFunction((selector) => {
      const row = document.querySelector(selector);
      return row?.getAttribute('aria-pressed') === 'true';
    }, rowSelector, { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!selected) {
    return { ok: false, actual: `Clicking row ${label} did not leave it selected. State: ${JSON.stringify(await readMappingState(page))}` };
  }
  return { ok: true };
}

async function readMappingState(page) {
  return page.evaluate(() => {
    const runtimeRows = (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      pin: row.pin,
      required: row.required,
      direction: row.direction,
    }));
    const domRows = Array.from(document.querySelectorAll('button[data-testid^="ide-hw-map-row-"]')).map((row) => {
      const testId = row.getAttribute('data-testid') ?? '';
      const rowId = testId.replace(/^ide-hw-map-row-/, '');
      return {
        testId,
        ariaPressed: row.getAttribute('aria-pressed') ?? '',
        className: row.getAttribute('class') ?? '',
        signal: document.querySelector(`[data-testid="ide-hw-map-row-signal-${rowId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        status: document.querySelector(`[data-testid="ide-hw-map-row-status-${rowId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        binding: document.querySelector(`[data-testid="ide-hw-map-row-binding-${rowId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        action: document.querySelector(`[data-testid="ide-hw-map-row-action-${rowId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      };
    });
    const progress = document.querySelector('[data-testid="ide-hw-map-preflight-details"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const header = document.querySelector('[data-testid="ide-hw-stage-rail"], [data-testid="ide-hw-workflow-ribbon"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { runtimeRows, domRows, progress, header };
  });
}

function writeTrialReport({ metrics, steps, issues, screenshots, browserProblems, baseUrl, status, stopAt }) {
  metrics.endedUtc = new Date().toISOString();
  metrics.elapsedMs = Date.now() - Date.parse(metrics.startedUtc);
  const summary = {
    schema: 'redbyte_jury_trial_v1',
    trialId: TRIAL_ID,
    branch: BRANCH,
    head: HEAD,
    shortHead: SHORT_HEAD,
    previewUrl: `${baseUrl}/`,
    status,
    stopAt: stopAt ?? null,
    nonClaims: [
      'No human review was performed.',
      'No human screen-reader certification was performed.',
      'No Vivado synthesis, implementation, bitstream, programming, or Basys3 physical observation proof was performed.',
    ],
    metrics,
    gitStatus: gitStatusLines(),
    dirtyWorktree: gitStatusLines().length > 0,
    steps,
    issues,
    screenshots,
    browserProblems,
  };
  const jsonPath = path.join(proofRoot, 'jury-half-adder-visible-trial.json');
  const mdPath = path.join(proofRoot, 'jury-half-adder-visible-trial.md');
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderMarkdown(summary), 'utf8');
  console.log(`[${TRIAL_ID}] report=${path.relative(repoRoot, jsonPath)}`);
  console.log(`[${TRIAL_ID}] status=${status}`);
}

function renderMarkdown(summary) {
  const lines = [
    '# Jury Half Adder Visible Trial',
    '',
    `- Status: ${summary.status}`,
    `- Branch: ${summary.branch}`,
    `- Head: ${summary.head}`,
    `- Preview URL: ${summary.previewUrl}`,
    `- Stop at: ${summary.stopAt ?? 'completed'}`,
    `- Clicks: ${summary.metrics.clicks}`,
    `- Scrolls: ${summary.metrics.scrolls}`,
    `- Backtracks: ${summary.metrics.backtracks}`,
    '',
    '## Non-Claims',
    '',
    ...summary.nonClaims.map((claim) => `- ${claim}`),
    '',
    '## Steps',
    '',
    '| Step | Status | At ms | Note |',
    '|---|---|---:|---|',
    ...summary.steps.map((step) => `| ${step.step} | ${step.status} | ${step.atMs} | ${step.note ?? ''} |`),
    '',
    '## Issues',
    '',
  ];
  if (summary.issues.length === 0) {
    lines.push('None recorded by this trial.', '');
  } else {
    lines.push('| ID | Severity | Surface | Step | Actual | Evidence |');
    lines.push('|---|---|---|---|---|---|');
    for (const issue of summary.issues) {
      lines.push(`| ${issue.id} | ${issue.severity} | ${issue.surface} | ${issue.step} | ${issue.actual.replace(/\|/g, '/')} | ${issue.evidence ?? ''} |`);
    }
    lines.push('');
  }
  lines.push('## Screenshots', '');
  for (const shot of summary.screenshots) lines.push(`- ${shot}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function safeName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cssEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function elapsedFrom(metrics) {
  return Date.now() - Date.parse(metrics.startedUtc);
}

async function waitForVisibleSaved(page) {
  await page.locator('[data-testid="ide-top-bar"]').waitFor({ state: 'visible', timeout: 5000 });
  const settled = await page
    .waitForFunction(() => {
      const topBar = document.querySelector('[data-testid="ide-top-bar"]');
      const saveDot = document.querySelector('[data-testid="ide-save-state"]');
      const state = topBar?.getAttribute('data-save-state') ?? saveDot?.getAttribute('aria-label') ?? '';
      return state === 'saved';
    }, null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (settled) return { ok: true };

  const actual = await page.evaluate(() => {
    const topBar = document.querySelector('[data-testid="ide-top-bar"]');
    const saveDot = document.querySelector('[data-testid="ide-save-state"]');
    const label = saveDot?.nextElementSibling?.textContent?.trim() ?? '';
    const state = topBar?.getAttribute('data-save-state') ?? saveDot?.getAttribute('aria-label') ?? 'unknown';
    return `Save indicator remained ${state}${label ? ` (${label})` : ''} after 15s.`;
  });
  return { ok: false, actual };
}

function git(args) {
  try {
    return execSync(`git ${args.join(' ')}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function loadJsZip() {
  const candidates = [
    path.join(repoRoot, 'packages', 'rb-apps', 'node_modules', 'jszip'),
    path.join(repoRoot, 'node_modules', '.pnpm', 'node_modules', 'jszip'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next workspace-linked package path.
    }
  }
  throw new Error('Unable to resolve workspace jszip package for downloaded ZIP inspection.');
}

function gitStatusLines() {
  try {
    return execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
  } catch {
    return ['<git status unavailable>'];
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function excerpt(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').slice(0, 1200);
}
