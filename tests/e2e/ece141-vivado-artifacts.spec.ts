import fs from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

const ARTIFACT_ROOT = path.resolve('.redbyte/product-immersion/sprint5-vivado-artifacts');

const STARTERS = [
  {
    id: 'logic-gates',
    name: 'Logic Gates',
    compareEvidence: /12\/12 match/i,
    expectedPins: new Map([
      ['SW0', 'V17'],
      ['SW1', 'V16'],
      ['LD0', 'U16'],
      ['LD1', 'E19'],
      ['LD2', 'U19'],
    ]),
    logicChecks: (topVhd: string, topXdc: string) => {
      expect(topVhd).toMatch(/\band\b/i);
      expect(topVhd).toMatch(/\bor\b/i);
      expect(topVhd).toMatch(/\bxor\b/i);
      expect(topXdc).not.toMatch(/^\s*create_clock\b/im);
    },
  },
  {
    id: 'half-adder',
    name: 'Half Adder',
    compareEvidence: /8\/8 match/i,
    expectedPins: new Map([
      ['SW0_A', 'V17'],
      ['SW1_B', 'V16'],
      ['LD0_CARRY', 'U16'],
      ['LD1_SUM', 'E19'],
    ]),
    logicChecks: (topVhd: string, topXdc: string) => {
      expect(topVhd).toMatch(/\bxor\b/i);
      expect(topVhd).toMatch(/\band\b/i);
      expect(pinForPort(topXdc, 'SW1_B')).toBe('V16');
      expect(pinForPort(topXdc, 'SW1_B')).not.toBe('W16');
      expect(topXdc).not.toMatch(/^\s*create_clock\b/im);
    },
  },
  {
    id: 'two-bit-counter',
    name: '2-Bit Up Counter',
    compareEvidence: /14\/14 match/i,
    expectedPins: new Map([
      ['CLK100MHZ', 'W5'],
      ['SW', 'V17'],
      ['BTNC', 'U18'],
      ['LED[0]', 'U16'],
      ['LED[1]', 'E19'],
    ]),
    logicChecks: (topVhd: string, topXdc: string) => {
      expect(topVhd).toMatch(/\brising_edge\s*\(\s*CLK100MHZ\s*\)/i);
      expect(topVhd).toMatch(/\bnot\s+BTNC\b/i);
      expect(topXdc).toMatch(/\bcreate_clock\s+-period\s+10\.000\b/i);
      expect(pinForPort(topXdc, 'CLK100MHZ')).toBe('W5');
    },
  },
] as const;

test.describe('ECE141 Vivado artifact correctness', () => {
  test('certified starters export E0-only Vivado packages with semantic parity', async ({ page }) => {
    fs.rmSync(ARTIFACT_ROOT, { recursive: true, force: true });
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

    for (const starter of STARTERS) {
      await page.goto('/');
      await dismissIntroChrome(page);
      await loadStarter(page, starter.id, starter.name);

      await openMode(page, 'verify');
      await runSavedCompare(page, starter.compareEvidence);

      await openMode(page, 'export');
      await expectE0OnlyExportEvidence(page);

      const zipPath = await downloadVivadoProject(page, starter.id);
      const artifacts = await readVivadoProjectArtifacts(zipPath);

      expect(artifacts.entries).toEqual([...artifacts.entries].sort());
      expect(artifacts.entries).toContain(`${artifacts.root}/project.rbproj.json`);
      expect(artifacts.entries).toContain(`${artifacts.root}/README.txt`);
      expect(artifacts.entries).toContain(`${artifacts.root}/vivado_import.tcl`);
      expect(artifacts.entries).toContain(`${artifacts.root}/${artifacts.root}.xpr`);
      expect(artifacts.entries).toContain(`${artifacts.root}/${artifacts.root}.srcs/sources_1/new/top.vhd`);
      expect(artifacts.entries).toContain(`${artifacts.root}/${artifacts.root}.srcs/constrs_1/new/top.xdc`);
      expect(artifacts.entries).toContain(`${artifacts.root}/EXPECTED_IO.json`);

      const vhdlEntity = parseVhdlEntity(artifacts.topVhd);
      expect(artifacts.vivadoTcl).toContain(`set top_module "${vhdlEntity.entity}"`);
      expect(artifacts.vivadoTcl).toContain('top.vhd');
      expect(artifacts.vivadoTcl).toContain('top.xdc');
      expect(artifacts.xpr).toContain(`TopModule" Val="${vhdlEntity.entity}"`);
      expect(artifacts.xpr).toContain('xc7a35tcpg236-1');

      const vhdlPorts = vhdlEntity.ports;
      const xdcPorts = new Set([...parsePackagePins(artifacts.topXdc).keys()].map(basePortName));
      for (const portName of vhdlPorts) {
        expect(xdcPorts, `${starter.name} XDC constrains VHDL port ${portName}`).toContain(portName);
      }

      for (const [portRef, expectedPin] of starter.expectedPins) {
        expect(pinForPort(artifacts.topXdc, portRef), `${starter.name} ${portRef}`).toBe(expectedPin);
      }

      const packagePins = [...parsePackagePins(artifacts.topXdc).values()];
      expect(new Set(packagePins).size, `${starter.name} duplicate PACKAGE_PIN use`).toBe(packagePins.length);

      expect(artifacts.readme).toMatch(/\bE0\b/i);
      expect(artifacts.readme).toMatch(/export package/i);
      expect(artifacts.readme).toMatch(/does not prove .*observed hardware behavior/i);
      expect(artifacts.readme).not.toMatch(/bitstream (is )?(ready|complete|generated)/i);
      expect(artifacts.readme).not.toMatch(/board (is )?(programmed|verified)/i);
      expect(artifacts.readme).not.toMatch(/observed (board|hardware) behavior (is )?(verified|proven|complete)/i);

      const manifest = JSON.parse(artifacts.projectJson);
      expect(manifest.kind).toBe('rb-project');
      expect(manifest.version).toBe(1);
      expect(manifest.meta.sourceExampleId).toBe(starter.id);
      expect(manifest.fpga.board).toBe('basys3');
      expect(manifest.fpga.top).toBe(vhdlEntity.entity);

      const expectedIo = JSON.parse(artifacts.expectedIoJson);
      expect(expectedIo.schemaVersion).toBe('rb.expected-io.v1');
      expect(expectedIo.board).toBe('basys3');
      expect(expectedIo.source).toBe('verify-run');
      expect(expectedIo.evidenceLevel).toBe('E0');
      expect(expectedIo.signals.length).toBeGreaterThan(0);
      for (const signal of expectedIo.signals) {
        expect(packagePins, `${starter.name} EXPECTED_IO package pin for ${signal.signal}`).toContain(
          signal.packagePin
        );
      }

      starter.logicChecks(artifacts.topVhd, artifacts.topXdc);
    }
  });
});

async function dismissIntroChrome(page: Page) {
  await page.getByTestId('ide-onboarding-skip').click({ timeout: 1_500 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss/i }).click({ timeout: 1_500 }).catch(() => {});
}

async function loadStarter(page: Page, id: string, name: string) {
  await page.goto('/?mode=project', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });
  await dismissIntroChrome(page);
  await openMode(page, 'project');
  const card = page.getByTestId(`ide-project-landing-example-${id}`);
  if ((await card.count()) > 0) {
    await card.click();
  } else {
    const browserExample = page.getByTestId(`ide-project-load-start-${id}`);
    if ((await browserExample.count()) === 0) {
      await page.getByTestId('ide-project-landing-example-logic-gates').click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      await openMode(page, 'project');
    }
    await expect(browserExample).toBeVisible({ timeout: 30_000 });
    await browserExample.click();
  }
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(new RegExp(escapeRegExp(name), 'i')).first()).toBeVisible({ timeout: 30_000 });
}

async function openMode(page: Page, mode: string) {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
}

async function runSavedCompare(page: Page, expectedEvidence: RegExp) {
  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-vcb-evidence')).toContainText(expectedEvidence, { timeout: 10_000 });
}

async function expectE0OnlyExportEvidence(page: Page) {
  await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/export\/package evidence only/i);
  await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
  await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
  await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);
  await expect(page.getByTestId('ide-export-readiness-hero')).not.toContainText(/observed physical board/i);
}

async function downloadVivadoProject(page: Page, starterId: string) {
  const downloadDir = path.join(ARTIFACT_ROOT, 'downloads');
  fs.mkdirSync(downloadDir, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    triggerDownload(page),
  ]);
  const suggested = download.suggestedFilename();
  expect(suggested).toMatch(/vivado-project\.zip$/i);
  const targetPath = path.join(downloadDir, `${starterId}-${suggested}`);
  await download.saveAs(targetPath);
  return targetPath;
}

async function triggerDownload(page: Page) {
  const downloadButton = page.getByTestId('ide-export-dock-download');
  if (await downloadButton.isVisible().catch(() => false)) {
    await downloadButton.click();
    return;
  }
  await page.getByTestId('ide-export-rebuild-btn').click();
}

async function readVivadoProjectArtifacts(zipPath: string) {
  const data = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(data);
  const entries = Object.keys(zip.files).filter((entry) => !zip.files[entry].dir).sort();
  const projectEntry = entries.find((entry) => entry.endsWith('/project.rbproj.json'));
  if (!projectEntry) {
    throw new Error(`project.rbproj.json missing from ${zipPath}`);
  }
  const root = projectEntry.split('/')[0];
  const readEntry = async (suffix: string) => {
    const entry = entries.find((candidate) => candidate.endsWith(suffix));
    if (!entry) {
      throw new Error(`${suffix} missing from ${zipPath}`);
    }
    return zip.files[entry].async('string');
  };
  const extractedDir = path.join(ARTIFACT_ROOT, 'extracted', root);
  fs.mkdirSync(extractedDir, { recursive: true });

  const artifacts = {
    root,
    entries,
    projectJson: await readEntry('/project.rbproj.json'),
    readme: await readEntry('/README.txt'),
    vivadoTcl: await readEntry('/vivado_import.tcl'),
    xpr: await readEntry(`/${root}.xpr`),
    topVhd: await readEntry('/top.vhd'),
    topXdc: await readEntry('/top.xdc'),
    expectedIoJson: await readEntry('/EXPECTED_IO.json'),
  };

  fs.writeFileSync(path.join(extractedDir, 'entries.txt'), entries.join('\n'));
  fs.writeFileSync(path.join(extractedDir, 'README.txt'), artifacts.readme);
  fs.writeFileSync(path.join(extractedDir, 'project.rbproj.json'), artifacts.projectJson);
  fs.writeFileSync(path.join(extractedDir, 'vivado_import.tcl'), artifacts.vivadoTcl);
  fs.writeFileSync(path.join(extractedDir, 'top.vhd'), artifacts.topVhd);
  fs.writeFileSync(path.join(extractedDir, 'top.xdc'), artifacts.topXdc);
  fs.writeFileSync(path.join(extractedDir, 'EXPECTED_IO.json'), artifacts.expectedIoJson);

  return artifacts;
}

function parseVhdlEntity(topVhd: string) {
  const portMatch = topVhd.match(
    /\bentity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\s+Port\s*\(([\s\S]*?)\);\s*end\s+(?:entity\s+)?\1\s*;/i
  );
  if (!portMatch) {
    throw new Error('VHDL entity port block not found');
  }
  return {
    entity: portMatch[1],
    ports: portMatch[2]
      .split(';')
      .map((line) => line.trim().match(/^([A-Za-z][A-Za-z0-9_]*)\s*:/)?.[1])
      .filter((port): port is string => Boolean(port)),
  };
}

function parsePackagePins(topXdc: string) {
  const pins = new Map<string, string>();
  const pattern = /set_property\s+PACKAGE_PIN\s+([A-Z0-9]+)\s+\[get_ports\s+\{([^}]+)\}\]/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(topXdc)) !== null) {
    pins.set(match[2], match[1]);
  }
  return pins;
}

function pinForPort(topXdc: string, portRef: string) {
  return parsePackagePins(topXdc).get(portRef);
}

function basePortName(portRef: string) {
  return portRef.replace(/\[[0-9]+\]$/, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
