import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { digestValue } from '../utils/digest';
import { importVivadoZipBytes } from '../apps/ide/zipImport';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';

const ZIP_FIXTURE_PATH = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/import/zip/01-and-gate-vivado.zip'
);

const EXPECTED_PROJECT_HASH = 'a6e77307';

describe('IDE zip import contract', () => {
  it('imports a Vivado-style zip into a deterministic project that is export-ready', async () => {
    const zipBytes = new Uint8Array(readFileSync(ZIP_FIXTURE_PATH));

    const importedA = await importVivadoZipBytes(zipBytes, {
      sourceName: '01-and-gate-vivado.zip',
    });
    const importedB = await importVivadoZipBytes(zipBytes, {
      sourceName: '01-and-gate-vivado.zip',
    });

    expect(importedA.detectedTopPath).toBe('top.vhd');
    expect(importedA.detectedTopLanguage).toBe('vhdl');
    expect(importedA.detectedXdcPath).toBe('basys3.xdc');
    expect(importedA.detectedFiles).toEqual(['top.vhd', 'basys3.xdc']);
    expect(importedA.ignoredFiles).toContain('README.md');

    const hashA = digestValue(importedA.project);
    const hashB = digestValue(importedB.project);
    expect(hashA).toBe(hashB);
    expect(hashA).toBe(EXPECTED_PROJECT_HASH);

    const exportView = buildExportViewModel(importedA.project);
    expect(exportView.status).toBe('ok');
    expect(exportView.errors).toHaveLength(0);
    expect(exportView.artifacts.some((artifact) => artifact.path === 'top.vhd')).toBe(true);
    expect(exportView.artifacts.some((artifact) => artifact.path === 'top.xdc')).toBe(true);
    expect(exportView.artifacts.some((artifact) => artifact.path === 'project.rbproj.json')).toBe(true);
  });
});
