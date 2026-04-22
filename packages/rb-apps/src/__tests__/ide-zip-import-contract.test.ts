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
    expect(importedA.status.compiler).toBe('runnable');
    expect(importedA.isImportRunnable).toBe(true);
    expect(importedA.compilerDiagnostics).toEqual([]);

    // Same bytes → same decoded project (catches non-determinism, timestamps, etc. in `project`)
    const hashA = digestValue(importedA.project);
    const hashB = digestValue(importedB.project);
    expect(hashA).toBe(hashB);

    // Student-meaningful structural contract (not a frozen digest of the whole `RBProject` — that drifts on any meta field)
    expect(importedA.importMode).toBe('reconstructed');
    expect(importedA.reconstructionLevel).toBe('full');
    expect(importedA.project.kind).toBe('rb-project');
    expect(importedA.project.name).toMatch(/gate|import|vivado/i);
    expect(importedA.parsedHdl.entityName).toBe('top');
    expect(importedA.project.circuit.nodes.length).toBe(4);
    expect(importedA.project.circuit.connections.length).toBe(3);
    expect(
      new Set(
        importedA.project.circuit.nodes
          .map((n) => n.type)
          .filter((t) => t === 'INPUT' || t === 'OUTPUT')
      ).size
    ).toBe(2);

    const exportView = buildExportViewModel(importedA.project);
    expect(exportView.status).toBe('ok');
    expect(exportView.errors).toHaveLength(0);
    expect(exportView.artifacts.some((artifact) => artifact.path === 'top.vhd')).toBe(true);
    expect(exportView.artifacts.some((artifact) => artifact.path === 'top.xdc')).toBe(true);
    expect(exportView.artifacts.some((artifact) => artifact.path === 'project.rbproj.json')).toBe(true);
  });
});
