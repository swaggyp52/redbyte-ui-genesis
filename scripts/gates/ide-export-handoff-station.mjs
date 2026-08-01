#!/usr/bin/env node

/**
 * Export handoff station gate.
 *
 * Contract:
 * 1) Export presents one visible handoff station at 1366x768.
 * 2) Draft/Needs Review does not look trusted, has one primary repair/build path,
 *    and may retain the contract-approved secondary draft download.
 * 3) Trusted/Ready keeps Export's primary action on build/download.
 * 4) Artifact previews, README E0 boundary, mapping, and Vivado next steps are visible.
 * 5) Browser Export never claims E1/E2/E3 success.
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

  const draftStation = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
  const draftText = await normalizedText(draftStation);
  const draftState = await draftStation.getAttribute('data-export-package-state');
  assert(
    draftState === 'draft' && /NEEDS REVIEW|DRAFT/i.test(draftText),
    `draft readiness hero must clearly read as draft/needs review, got state=${draftState} text="${draftText}"`
  );
  assert(
    !/trusted package available|Browser-E0 package ready/i.test(draftText),
    'draft readiness hero must not look like a trusted/ready export'
  );
  assert(
    /Open Simulate|Simulate|Compare|repair|review/i.test(await normalizedText(currentExportAction(page))),
    'draft readiness primary path must send the student toward repair/review evidence'
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

  const readyInspector = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
  const readyToBuildStatus = await readyInspector.getAttribute('data-export-package-state');
  assert(
    readyToBuildStatus === 'draft',
    `verified export should remain a buildable draft before download, got "${readyToBuildStatus}"`
  );
  await assertOneVisiblePrimary(page, /Build Current Bundle|Rebuild Current Bundle|Download/i, 'ready-to-build export');

  await assertArtifactWorkspace(page);
  await assertReadmeBoundary(page);
  await assertMappingSummary(page);
  await assertEvidenceBoundary(page);
  await assertVivadoNextSteps(page);
  await assertNoRootHorizontalOverflow(page);
  await assertNoKeyRegionOverlap(page);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    currentExportAction(page).click(),
  ]);
  const downloadFailure = await download.failure();
  assert(!downloadFailure, `current export package download failed: ${downloadFailure}`);
  await page.waitForSelector('[data-testid="ide-export-download-success"]', { timeout: 10000 });

  await assertStationBasics(page, 'trusted export');
  const trustedStatus = await page.locator('[data-testid="ide-export-package-inspector-v1"]').first().getAttribute('data-export-package-state');
  assert(trustedStatus === 'ready', `trusted readiness hero must show ready, got "${trustedStatus}"`);
  await assertOneVisiblePrimary(page, /Download|Re-download|Build|Bundle|Project ZIP/i, 'trusted export');
  const trustedPrimary = await normalizedText(currentExportAction(page));
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
  await page.waitForSelector('[data-testid="ide-export-readiness-hero"]', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-package-inspector-v1"]', { state: 'visible', timeout: 10000 });
}

async function assertStationBasics(page, label) {
  const station = page.locator('[data-testid="ide-export-package-inspector-v1"]');
  assert((await station.count()) === 1, `${label} must render exactly one readiness authority`);
  assert(await visible(station), `${label} readiness authority must be visible`);
  await openGeneratedFiles(page, label);
  await assertFitsViewport(page, station, `${label} readiness authority`);

  const packageContents = page.locator('[data-testid="ide-export-package-contents"]').first();
  assert(await visible(packageContents), `${label} package contents summary must be visible`);
  const e0Boundary = page.locator('[data-testid="ide-export-e0-boundary-summary"]').first();
  assert(await visible(e0Boundary), `${label} Browser E0 boundary must be visible`);

  const primary = currentExportAction(page);
  assert(await visible(primary), `${label} primary action must be visible`);
}

async function assertOneVisiblePrimary(page, expectedLabel, label) {
  const actionButtons = page.locator('[data-testid="ide-export-primary-actions"] button');
  const packageState = await page
    .locator('[data-testid="ide-export-package-inspector-v1"]')
    .getAttribute('data-export-package-state');
  assert(
    (await actionButtons.count()) >= 1 && (await actionButtons.count()) <= 2,
    `${label} must expose one owning handoff action with at most one secondary draft download`
  );
  const primary = currentExportAction(page);
  assert(await visible(primary), `${label} primary handoff action must be visible`);
  const buttonText = await normalizedText(primary);
  assert(
    expectedLabel.test(buttonText),
    `${label} primary action must be build/download oriented, got "${buttonText}"`
  );
  if (packageState === 'draft') {
    const draftDownload = page.locator('[data-testid="ide-export-draft-download-v1"]');
    assert((await draftDownload.count()) <= 1, `${label} must expose at most one secondary draft download`);
    if ((await draftDownload.count()) === 1) {
      assert(await visible(draftDownload), `${label} secondary draft download must be visible`);
      assert(/Download draft/i.test(await normalizedText(draftDownload)), `${label} secondary action must be labeled as a draft download`);
    }
  }
}

async function assertArtifactWorkspace(page) {
  await openGeneratedFiles(page, 'artifact workspace');
  const artifactWorkspace = page.locator('[data-testid="ide-export-file-browser"]').first();
  await artifactWorkspace.scrollIntoViewIfNeeded();
  assert(await visible(artifactWorkspace), 'artifact workspace must be visible');
  const artifactText = (await normalizedText(artifactWorkspace)).toLowerCase();
  for (const fileName of REQUIRED_ARTIFACTS) {
    assert(artifactText.includes(fileName.toLowerCase()), `artifact workspace must include ${fileName}`);
  }
  assert(
    await visible(page.locator('[data-testid="ide-export-selected-preview-v1"]').first()),
    'selected generated artifact preview must be visible after disclosure'
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
  const mapping = page.locator('[data-testid="ide-export-upstream-mapping"]').first();
  assert(await visible(mapping), 'upstream readiness must expose Board & Constraints status');
  const mappingText = await normalizedText(mapping);
  assert(/Board & Constraints/i.test(mappingText), `mapping summary must name its owning workspace, got "${mappingText}"`);
  assert(/Ready|required missing|blocker|assign/i.test(mappingText), `mapping summary must expose readiness, got "${mappingText}"`);
}

async function assertEvidenceBoundary(page) {
  const boundary = page.locator('[data-testid="ide-export-e0-boundary-summary"]').first();
  await boundary.scrollIntoViewIfNeeded();
  assert(await visible(boundary), 'evidence boundary section must be visible');
  const boundaryText = await normalizedText(boundary);
  assert(/Browser E0/i.test(boundaryText), 'evidence boundary must name Browser E0');
  assert(/Vivado.*bitstream.*external/i.test(boundaryText), 'Vivado and bitstream proof must remain external');
  const readmeText = await normalizedText(page.locator('[data-testid="ide-export-preview-code"]').first());
  assert(/E1.*E2.*E3/i.test(readmeText), 'README must keep E1/E2/E3 evidence separate');
  assert(!/E1\s+(ready|passed|complete)/i.test(boundaryText), 'Export browser must not claim E1 success');
  assert(!/E2\s+(ready|passed|complete)/i.test(boundaryText), 'Export browser must not claim E2 success');
  assert(!/E3\s+(ready|passed|complete)/i.test(boundaryText), 'Export browser must not claim E3 success');
}

async function assertVivadoNextSteps(page) {
  await selectArtifact(page, 'README.txt');
  const steps = page.locator('[data-testid="ide-export-preview-code"]').first();
  await steps.scrollIntoViewIfNeeded();
  assert(await visible(steps), 'README Vivado next steps must be visible');
  const stepsText = await normalizedText(steps);
  assert(/Vivado/i.test(stepsText), 'README next steps must be labeled as downstream Vivado work');
  assert(/synthesis/i.test(stepsText), 'Vivado next steps must mention synthesis');
  assert(/implementation/i.test(stepsText), 'Vivado next steps must mention implementation');
  assert(/bitstream/i.test(stepsText), 'Vivado next steps must mention bitstream');
  assert(/program/i.test(stepsText), 'Vivado next steps must mention board programming as an external next step');
}

async function selectArtifact(page, artifactPath) {
  await openGeneratedFiles(page, `preview ${artifactPath}`);
  const tab = page
    .locator('button[data-testid^="ide-export-file-"]')
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
    ['files', '[data-testid="ide-export-file-browser"]'],
    ['preview', '[data-testid="ide-export-selected-preview-v1"]'],
    ['evidence', '[data-testid="ide-export-e0-boundary-summary"]'],
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

function currentExportAction(page) {
  return page.locator(
    '[data-testid="ide-export-package-build-v1"], [data-testid="ide-export-package-download-v1"]'
  ).first();
}

async function openGeneratedFiles(page, label) {
  const workspace = page.locator('[data-testid="ide-export-package-files"]').first();
  await workspace.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="ide-export-file-browser"]').first().waitFor({ state: 'visible', timeout: 10000 });
  assert(await visible(workspace), `${label}: generated files workspace must remain directly visible`);
}

function rectOverlapArea(a, b) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
