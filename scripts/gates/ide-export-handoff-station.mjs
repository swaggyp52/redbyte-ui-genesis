#!/usr/bin/env node

/**
 * Export handoff station gate.
 *
 * Contract:
 * 1) Export presents one visible handoff station at 1366x768.
 * 2) Draft/Needs Review does not look trusted and has a repair path.
 * 3) Trusted/Ready keeps Export's primary action on build/download.
 * 4) Artifact previews, package boundary, mapping, and Vivado next steps are visible.
 * 5) Browser Export never claims Vivado build, programming, or observed-board success.
 */

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const REQUIRED_ARTIFACTS = [
  'README.txt',
  'top.vhd',
  'top.xdc',
  'testbench.vhd',
  'vivado_import.tcl',
];

await runIdeGate('IDE export handoff station satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-signal-tour' });

  await openExport(page);
  await assertStationBasics(page, 'draft export');

  const draftStation = page.locator('[data-testid="ide-export-handoff-station"]').first();
  const draftText = await normalizedText(draftStation);
  assert(
    /NEEDS REVIEW|DRAFT/i.test(draftText),
    `draft station must clearly read as draft/needs review, got "${draftText}"`
  );
  const draftPackageStatus = await normalizedText(page.locator('[data-testid="ide-export-package-handoff-status"]'));
  const draftTrustBanner = await normalizedText(page.locator('[data-testid="ide-export-trust-banner"]'));
  assert(
    !/PACKAGE READY/i.test(draftPackageStatus) &&
      !/\bREADY\b/i.test(draftTrustBanner) &&
      !/trusted package available/i.test(draftText),
    'draft station must not look like a trusted/ready export'
  );
  assert(
    /Open Verify|Verify|Compare|repair|review/i.test(await normalizedText(page.locator('[data-testid="ide-export-rebuild-btn"]'))),
    'draft station primary path must send the student toward repair/review evidence'
  );

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), 'handoff station trusted proof requires Verify Compare mode');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const verifyStatus = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(verifyStatus), `trusted handoff station requires current Compare PASS, got "${verifyStatus}"`);

  await openExport(page);
  await assertStationBasics(page, 'ready-to-build export');

  const readyToBuildStatus = await normalizedText(page.locator('[data-testid="ide-export-package-handoff-status"]'));
  assert(
    /READY TO BUILD/i.test(readyToBuildStatus),
    `verified export should begin as READY TO BUILD, got "${readyToBuildStatus}"`
  );
  assertOneVisiblePrimary(page, /Build Current Bundle|Rebuild Current Bundle|Download/i, 'ready-to-build export');

  await assertArtifactWorkspace(page);
  await assertReadmeBoundary(page);
  await assertMappingSummary(page);
  await assertEvidenceBoundary(page);
  await assertVivadoNextSteps(page);
  await assertNoRootHorizontalOverflow(page);
  await assertNoKeyRegionOverlap(page);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('[data-testid="ide-export-rebuild-btn"]').first().click(),
  ]);
  const downloadFailure = await download.failure();
  assert(!downloadFailure, `current export package download failed: ${downloadFailure}`);
  await page.waitForSelector('[data-testid="ide-export-download-success"]', { timeout: 10000 });

  await assertStationBasics(page, 'trusted export');
  const trustedStatus = await normalizedText(page.locator('[data-testid="ide-export-package-handoff-status"]'));
  assert(/PACKAGE READY|\bREADY\b/i.test(trustedStatus), `trusted handoff station must show READY, got "${trustedStatus}"`);
  assertOneVisiblePrimary(page, /Download|Re-download|Build|Bundle|Project ZIP/i, 'trusted export');
  const trustedPrimary = await normalizedText(page.locator('[data-testid="ide-export-rebuild-btn"]'));
  assert(
    !/Open Program Handoff/i.test(trustedPrimary),
    'trusted Export station primary action must remain build/download, not hardware program handoff'
  );
  await assertEvidenceBoundary(page);
  await assertNoRootHorizontalOverflow(page);
});

async function openExport(page) {
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-readiness-hero"]', { state: 'attached', timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-handoff-station"]', { state: 'visible', timeout: 10000 });
}

async function assertStationBasics(page, label) {
  const station = page.locator('[data-testid="ide-export-handoff-station"]');
  assert((await station.count()) === 1, `${label} must render exactly one handoff station`);
  assert(await visible(station), `${label} handoff station must be visible`);
  await assertFitsViewport(page, station, `${label} handoff station`);

  const packageHandoff = page.locator('[data-testid="ide-export-package-handoff"]').first();
  assert(await visible(packageHandoff), `${label} package handoff must be visible without opening details`);

  const trustBanner = page.locator('[data-testid="ide-export-trust-banner"]').first();
  assert(await visible(trustBanner), `${label} trust banner must be visible in the station`);

  const primary = page.locator('[data-testid="ide-export-rebuild-btn"]').first();
  assert(await visible(primary), `${label} primary action must be visible`);
}

async function assertOneVisiblePrimary(page, expectedLabel, label) {
  const primaryActions = page.locator(
    '[data-testid="ide-export-handoff-station"] [data-testid="ide-export-primary-handoff-cta"] button'
  );
  assert((await primaryActions.count()) === 1, `${label} must expose exactly one primary handoff action`);
  const primary = primaryActions.first();
  assert(await visible(primary), `${label} primary handoff action must be visible`);
  const buttonText = await normalizedText(primary);
  assert(
    expectedLabel.test(buttonText),
    `${label} primary action must be build/download oriented, got "${buttonText}"`
  );
}

async function assertArtifactWorkspace(page) {
  const artifactWorkspace = page.locator('[data-testid="ide-export-artifact-preview"]').first();
  await artifactWorkspace.scrollIntoViewIfNeeded();
  assert(await visible(artifactWorkspace), 'artifact workspace must be visible');
  const artifactText = (await normalizedText(artifactWorkspace)).toLowerCase();
  for (const fileName of REQUIRED_ARTIFACTS) {
    assert(artifactText.includes(fileName.toLowerCase()), `artifact workspace must include ${fileName}`);
  }
  assert(
    await visible(page.locator('[data-testid="ide-export-generated-previews"]').first()),
    'generated artifact preview must be open/discoverable'
  );
  assert(
    await visible(page.locator('[data-testid="ide-export-preview-code"]').first()),
    'generated artifact preview code must be visible'
  );
}

async function assertReadmeBoundary(page) {
  await selectArtifact(page, 'README.txt');
  const preview = page.locator('[data-testid="ide-export-preview-code"]').first();
  await preview.scrollIntoViewIfNeeded();
  assert(await visible(preview), 'README generated preview must be visible');
  const previewText = await normalizedText(preview);
  assert(/E0 package evidence only|Evidence level:\s*E0 export package only/i.test(previewText), 'README preview must state the E0 evidence boundary');
  assert(/E1\/E2\/E3 evidence separately|E1.*E2.*E3/i.test(previewText), 'README preview must keep E1/E2/E3 external/manual');
  assert(/does not prove Vivado build|does not prove board behavior/i.test(previewText), 'README preview must not overclaim Vivado or board proof');
}

async function assertMappingSummary(page) {
  const compactMapping = await normalizedText(
    page.locator('[data-testid="ide-export-handoff-summary-mapping"] .ide-export-handoff-summary-value')
  );
  const factMapping = await normalizedText(page.locator('[data-testid="ide-export-handoff-mapping"]'));
  assert(compactMapping.length > 0, 'handoff station must include a mapping summary');
  assert(factMapping.length > 0, 'handoff facts must include mapping completeness');
  assert(
    compactMapping === factMapping,
    `mapping summary must agree across station rows, got "${compactMapping}" vs "${factMapping}"`
  );
}

async function assertEvidenceBoundary(page) {
  const boundary = page.locator('[data-testid="ide-export-evidence-boundary"]').first();
  await boundary.scrollIntoViewIfNeeded();
  assert(await visible(boundary), 'evidence boundary section must be visible');
  const boundaryText = await normalizedText(boundary);
  for (const label of ['Package', 'Build', 'Program', 'Observe']) {
    assert(boundaryText.includes(label), `evidence boundary must include ${label}`);
  }
  assert(!/\bE0\b|\bE1\b|\bE2\b|\bE3\b/.test(boundaryText), 'Export student boundary must not expose E-tier labels');
  assert(/Run Vivado synthesis|Record outside RedByte/i.test(boundaryText), 'Vivado build must require an outside record');
  assert(/Program success proves delivery to the board only/i.test(boundaryText), 'board programming must not imply behavior proof');
  assert(/Manual record required|record physical/i.test(boundaryText), 'board observation must require a manual record');
  assert(!/Vivado build\s+(ready|passed|complete)/i.test(boundaryText), 'Export browser must not claim Vivado build success');
  assert(!/board programming\s+(ready|passed|complete)/i.test(boundaryText), 'Export browser must not claim board programming success');
  assert(!/observed board behavior\s+(ready|passed|complete)/i.test(boundaryText), 'Export browser must not claim observed-board success');
}

async function assertVivadoNextSteps(page) {
  const steps = page.locator('[data-testid="ide-export-vivado-ready"]').first();
  await steps.scrollIntoViewIfNeeded();
  assert(await visible(steps), 'Vivado next steps must be visible');
  const stepsText = await normalizedText(steps);
  assert(/Open in Vivado/i.test(stepsText), 'Vivado next steps must be labeled as downstream Vivado work');
  assert(/synthesis/i.test(stepsText), 'Vivado next steps must mention synthesis');
  assert(/implementation/i.test(stepsText), 'Vivado next steps must mention implementation');
  assert(/bitstream/i.test(stepsText), 'Vivado next steps must mention bitstream');
  assert(/program/i.test(stepsText), 'Vivado next steps must mention board programming as an external next step');
}

async function selectArtifact(page, artifactPath) {
  const tab = page
    .locator('[data-testid^="ide-export-artifact-tab-"]')
    .filter({ hasText: artifactPath })
    .first();
  assert(await tab.isVisible().catch(() => false), `${artifactPath} artifact tab must be visible`);
  await tab.click();
  await page.waitForFunction(
    (expected) => {
      const marker = document.querySelector('[data-testid="ide-export-preview-path"]');
      return (marker?.textContent ?? '').trim() === expected;
    },
    artifactPath,
    { timeout: 10000 }
  );
}

async function assertNoRootHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const overflow = Math.max(metrics.docScrollWidth, metrics.bodyScrollWidth) - metrics.viewportWidth;
  assert(overflow <= 1, `Export must not create root horizontal overflow at 1366px, overflow=${overflow}`);
}

async function assertNoKeyRegionOverlap(page) {
  const selectors = [
    ['station', '[data-testid="ide-export-handoff-station"]'],
    ['evidence', '[data-testid="ide-export-evidence-boundary"]'],
    ['artifacts', '[data-testid="ide-export-artifact-preview"]'],
    ['vivado', '[data-testid="ide-export-vivado-ready"]'],
  ];
  const boxes = [];
  for (const [label, selector] of selectors) {
    const box = await page.locator(selector).first().evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    }).catch(() => null);
    assert(box, `${label} region must have layout bounds`);
    boxes.push({ label, box });
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const overlap = rectOverlapArea(boxes[i].box, boxes[j].box);
      assert(overlap < 2, `${boxes[i].label} and ${boxes[j].label} regions must not overlap`);
    }
  }
}

async function assertFitsViewport(page, locator, label) {
  const box = await locator.first().boundingBox();
  assert(box, `${label} must have a measurable layout box`);
  const viewport = page.viewportSize();
  assert(viewport, `${label} gate requires a viewport`);
  assert(box.x >= -1, `${label} must not overflow left edge: x=${box.x}`);
  assert(box.x + box.width <= viewport.width + 1, `${label} must not overflow right edge`);
}

function rectOverlapArea(a, b) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
