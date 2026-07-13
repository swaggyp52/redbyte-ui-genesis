#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', {
  paths: [path.join(process.cwd(), 'packages', 'rb-apps')],
}));

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'import-recovery-contract'
);
const FIXTURE_DIR = path.join(ARTIFACT_ROOT, 'fixtures');

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

async function screenshotIfRequested(page, name) {
  const root = process.env.RB_IMPORT_RECOVERY_CAPTURE_DIR;
  if (!root) return;
  await mkdir(root, { recursive: true });
  const viewport = page.viewportSize();
  const taggedName = viewport
    ? name.replace(/1366x768$/, `${viewport.width}x${viewport.height}`)
    : name;
  await page.screenshot({ path: path.join(root, `${taggedName}.png`), fullPage: false });
}

function resolveViewport() {
  const value = process.env.RB_IMPORT_RECOVERY_VIEWPORT;
  if (!value) return { width: 1366, height: 768 };
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (!match) return { width: 1366, height: 768 };
  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

async function dismissOnboardingIfPresent(page) {
  const skipButton = page.locator('[data-testid="ide-onboarding-skip"]').first();
  const overlay = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  if (!(await skipButton.isVisible().catch(() => false))) return;
  await skipButton.click();
  await overlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
}

async function openProject(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await dismissOnboardingIfPresent(page);
}

async function openImportFromProject(page) {
  const importPrimary = page.locator('[data-testid="ide-project-import-primary"]').first();
  if (await visible(importPrimary)) {
    assert(/Import Project/i.test(await text(importPrimary)), 'Project first launch must label the utility action Import Project');
    await importPrimary.click();
    await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
    return;
  }

  const importPath = page.locator('[data-testid="ide-project-path-import-recover"]').first();
  if (!(await visible(importPath))) {
    const changeProject = page.locator('[data-testid="ide-project-change-project"]').first();
    assert(await visible(changeProject), 'Loaded Project must expose Change Project before replacement/recovery paths');
    await changeProject.click();
  }
  assert(await visible(importPath), 'Loaded Project must reveal Import Project after Change Project opens');
  assert(/Import Project/i.test(await text(importPath)), 'Loaded Project must label the disclosed utility action Import Project');
  await importPath.click();
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
}

async function openMode(page, mode) {
  await page.locator(`[data-testid="mode-button-${mode}"]`).first().click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
}

async function ensureUploadStage(page) {
  const uploadTab = page.locator('[data-testid="ide-import-tab-upload"]').first();
  if (await visible(uploadTab)) {
    await uploadTab.click();
  }
}

async function buildManifestZip() {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const project = {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
    name: 'Import Recovery Contract AND',
    description: 'Browser gate fixture for RedByte manifest restore.',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', position: { x: 100, y: 140 }, label: 'SW0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', position: { x: 100, y: 280 }, label: 'SW1', config: {}, state: {} },
        { id: 'and_gate', type: 'AND', position: { x: 320, y: 200 }, label: 'AND', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', position: { x: 520, y: 200 }, label: 'LD0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and_gate', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and_gate', portName: 'b' } },
        { from: { nodeId: 'and_gate', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: [
            'library IEEE;',
            'use IEEE.STD_LOGIC_1164.ALL;',
            'entity top is',
            '  port ( SW0 : in STD_LOGIC; SW1 : in STD_LOGIC; LD0 : out STD_LOGIC );',
            'end top;',
            'architecture Structural of top is',
            '  component AND2',
            '    port (A : in STD_LOGIC; B : in STD_LOGIC; Y : out STD_LOGIC);',
            '  end component;',
            'begin',
            '  U1 : AND2 port map (A => SW0, B => SW1, Y => LD0);',
            'end Structural;',
          ].join('\n'),
        },
      ],
    },
    fpga: {
      board: 'basys3',
      top: 'top',
      part: 'xc7a35tcpg236-1',
      constraints: {
        type: 'xdc',
        text: [
          'set_property PACKAGE_PIN V17 [get_ports {SW0}]',
          'set_property PACKAGE_PIN W16 [get_ports {SW1}]',
          'set_property PACKAGE_PIN U16 [get_ports {LD0}]',
        ].join('\n'),
      },
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', pin: 'V17', label: 'SW0' },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', pin: 'W16', label: 'SW1' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'ld0_node', port: 'in', pin: 'U16', label: 'LD0' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 1, inputs: { sw0_node: 0, sw1_node: 1 }, expected: { ld0_node: 0 } },
      { tick: 2, inputs: { sw0_node: 1, sw1_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 3, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 1 } },
    ],
    meta: {
      projectId: 'import-recovery-contract-and',
      projectKind: 'import',
      tags: ['classroom', 'import-recovery-contract'],
    },
  };

  const zip = new JSZip();
  zip.file('redbyte-project/project.rbproj.json', JSON.stringify(project, null, 2));
  zip.file('redbyte-project/top.vhd', project.hdl.sources[0].text);
  zip.file('redbyte-project/top.xdc', project.fpga.constraints.text);
  zip.file('redbyte-project/README.txt', 'RedByte import recovery contract fixture.');
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const filePath = path.join(FIXTURE_DIR, 'import-recovery-redbyte-manifest.zip');
  await writeFile(filePath, bytes);
  return filePath;
}

async function buildCorruptManifestZip() {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const zip = new JSZip();
  zip.file('broken/project.rbproj.json', '{"kind":"rb-project","version":1,"name":');
  zip.file(
    'broken/top.vhd',
    [
      'library IEEE;',
      'use IEEE.STD_LOGIC_1164.ALL;',
      'entity broken is',
      '  port ( A : in STD_LOGIC; Y : out STD_LOGIC );',
      'end broken;',
      'architecture rtl of broken is begin Y <= A; end rtl;',
    ].join('\n')
  );
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const filePath = path.join(FIXTURE_DIR, 'import-recovery-corrupt-manifest.zip');
  await writeFile(filePath, bytes);
  return filePath;
}

async function buildNonZipUploadFixture() {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const filePath = path.join(FIXTURE_DIR, 'import-recovery-not-a-zip.txt');
  await writeFile(filePath, 'This is not a ZIP archive.\n');
  return filePath;
}

function assertNoHardwareOverclaim(surfaceText) {
  const forbidden = [
    /observed physical board/i,
    /programmed (the )?board/i,
    /vivado build passed/i,
    /bitstream verified/i,
    /hardware proof/i,
  ];
  const hit = forbidden.find((pattern) => pattern.test(surfaceText));
  assert(!hit, `Import must not overclaim Vivado or board proof: ${hit}`);
}

await runIdeGate('IDE import recovery contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize(resolveViewport());
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const validZip = await buildManifestZip();
  const corruptZip = await buildCorruptManifestZip();
  const nonZipUpload = await buildNonZipUploadFixture();

  await openProject(page, baseUrl);
  const projectLanding = page.locator('[data-testid="ide-project-command-center"]').first();
  assert(await visible(projectLanding), 'Project command center must be visible before import');
  assert(
    /Import Project/i.test(await text(projectLanding)),
    'Project command center must expose Import Project'
  );
  await screenshotIfRequested(page, 'project-import-recover-entry-1366x768');

  await openImportFromProject(page);
  const importSurface = page.locator('[data-testid="ide-mode-import"]').first();
  assert(await visible(importSurface), 'Import utility surface must open from Project');
  const firstLook = page.locator('[data-testid="ide-import-start-shell"]').first();
  assert(await visible(firstLook), 'Import must have one clear utility/recovery start surface');
  await screenshotIfRequested(page, 'import-empty-1366x768');
  const firstLookText = await text(firstLook);
  assert(
    /redbyte project restore/i.test(firstLookText) && /highest[- ]fidelity|full[- ]fidelity/i.test(firstLookText),
    `Import first look must identify RedByte project restore as highest fidelity; got "${firstLookText}"`
  );
  assert(
    /(vivado zip|vhdl)/i.test(firstLookText) && /reconstruct|fidelity[- ]limited|partial/i.test(firstLookText),
    `Import first look must identify Vivado/VHDL as reconstruction with fidelity limits; got "${firstLookText}"`
  );
  assert(
    /current project|nothing is overwritten|not overwritten/i.test(firstLookText),
    'Import first look must say current work is safe until confirmation'
  );
  assertNoHardwareOverclaim(firstLookText);

  await openProject(page, baseUrl);
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await openMode(page, 'project');
  const loadedProject = page.locator('[data-testid="ide-project-command-center"]').first();
  assert(await visible(loadedProject), 'Loaded Project must keep command center visible');
  const changeProject = page.locator('[data-testid="ide-project-change-project"]').first();
  assert(await visible(changeProject), 'Loaded Project must expose Change Project');
  await changeProject.click();
  assert(
    await visible(page.locator('[data-testid="ide-project-path-import-recover"]').first()),
    'Loaded Project must reveal Import Project after Change Project opens'
  );
  await screenshotIfRequested(page, 'project-loaded-import-recover-entry-1366x768');

  await openImportFromProject(page);
  await ensureUploadStage(page);
  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles(nonZipUpload);
  const nonZipError = page.locator('[data-testid="ide-import-zip-error"]').first();
  await nonZipError.waitFor({ state: 'visible', timeout: 30000 });
  const nonZipErrorText = await text(nonZipError);
  assert(/\.zip archive/i.test(nonZipErrorText), `Non-ZIP upload must name the ZIP archive requirement; got "${nonZipErrorText}"`);
  assert(/no files were changed/i.test(nonZipErrorText), `Non-ZIP upload must say the active project was not changed; got "${nonZipErrorText}"`);
  assert(
    !/No port definitions|valid LOC|HDL declares|XDC file/i.test(nonZipErrorText),
    `Non-ZIP upload must not show HDL/XDC port-reconstruction guidance; got "${nonZipErrorText}"`
  );
  await screenshotIfRequested(page, 'import-non-zip-failure-1366x768');

  await ensureUploadStage(page);
  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles(corruptZip);
  const zipError = page.locator('[data-testid="ide-import-zip-error"]').first();
  await zipError.waitFor({ state: 'visible', timeout: 30000 });
  const zipErrorText = await text(zipError);
  assert(/could not open zip/i.test(zipErrorText), 'Corrupt ZIP must show a visible failure state');
  assert(
    /no files were changed|paste hdl|re-export/i.test(zipErrorText),
    `Corrupt ZIP failure must provide safe recovery next action; got "${zipErrorText}"`
  );
  assert(
    !/No port definitions|valid LOC|HDL declares|XDC file/i.test(zipErrorText),
    `Corrupt manifest ZIP failure must not show generic HDL/XDC port-reconstruction guidance; got "${zipErrorText}"`
  );
  await screenshotIfRequested(page, 'import-corrupt-failure-1366x768');

  await openMode(page, 'hardware');
  const sw0Binding = page.locator('[data-testid="ide-hw-map-row-binding-sw0"]').first();
  await sw0Binding.waitFor({ state: 'visible', timeout: 30000 });
  assert(
    /SW0|V17/i.test(await text(sw0Binding)),
    'Failed import must not replace or clear the active Logic Gates project mapping'
  );

  await openMode(page, 'project');
  await openImportFromProject(page);
  await ensureUploadStage(page);
  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles(validZip);
  await page.locator('[data-testid="ide-import-zip-inspection"]').waitFor({ state: 'visible', timeout: 30000 });
  const zipAuthorityText = await text(page.locator('[data-testid="ide-import-zip-authority"]').first());
  assert(
    /one source of truth|embedded manifest/i.test(zipAuthorityText),
    'RedByte manifest import must identify the embedded manifest as authoritative'
  );
  assert(/reference only|not used to build/i.test(zipAuthorityText), 'Manifest import must demote loose HDL/XDC');
  await screenshotIfRequested(page, 'import-redbyte-manifest-inspection-1366x768');

  await page.locator('[data-testid="ide-import-process-design"]').click();
  await page.locator('[data-testid="ide-import-commit-preview"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('[data-testid="ide-import-recon-manifest"]').waitFor({ state: 'visible', timeout: 30000 });
  await screenshotIfRequested(page, 'import-redbyte-manifest-review-1366x768');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid="ide-import-apply-confirm"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 30000 });
  await screenshotIfRequested(page, 'imported-project-design-1366x768');

  await openMode(page, 'project');
  const bridgeText = await text(page.locator('[data-testid="ide-project-bridge"]').first());
  assert(/full restore/i.test(bridgeText), 'Project must surface full import fidelity after manifest restore');
  await screenshotIfRequested(page, 'imported-project-project-state-1366x768');

  await openMode(page, 'verify');
  assert(
    !(await visible(page.locator('[data-testid="ide-verify-pass-hero"]').first())),
    'Imported prior Verify PASS must not be treated as current trusted proof'
  );
  const verifyText = await text(page.locator('[data-testid="ide-mode-verify"]').first());
  assert(
    /run|verify|saved checks|vectors/i.test(verifyText),
    'Imported project Verify state must require a fresh run or review'
  );
  assertNoHardwareOverclaim(verifyText);
  await screenshotIfRequested(page, 'imported-project-verify-state-1366x768');

  await openMode(page, 'export');
  const exportText = await text(page.locator('[data-testid="ide-mode-export"]').first());
  assert(/E0|export|package/i.test(exportText), 'Imported project Export state must stay package/evidence framed');
  assertNoHardwareOverclaim(exportText);
  await screenshotIfRequested(page, 'imported-project-export-state-1366x768');
});
