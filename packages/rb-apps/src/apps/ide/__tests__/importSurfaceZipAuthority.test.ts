import { describe, expect, it } from 'vitest';
import type { ZipImportInspection } from '../zipImport';
import { getZipImportAuthorityModel } from '../importSurfaceZipAuthority';

const base: ZipImportInspection = {
  sourceName: 't.zip',
  importMode: 'reconstructed',
  detectedTopPath: 'top.vhd',
  detectedTopLanguage: 'vhdl',
  detectedXdcPath: 'board.xdc',
  preservedRtlCompanionPaths: [],
  detectedTestbenchPaths: [],
  detectedFiles: ['top.vhd', 'board.xdc'],
  ignoredFiles: ['README.md'],
  hdlCandidates: ['top.vhd'],
  xdcCandidates: ['board.xdc'],
  parsedHdl: {} as ZipImportInspection['parsedHdl'],
  warnings: [],
  parserDiagnostics: [],
  compilerDiagnostics: [],
  ideDiagnostics: [],
  status: { parse: 'success', reconstruction: 'success', compiler: 'runnable' },
  isImportRunnable: true,
  weakPinPorts: [],
  reconstructionLevel: 'full',
  project: {} as ZipImportInspection['project'],
};

describe('getZipImportAuthorityModel', () => {
  it('describes a manifest ZIP as authoritative from embedded project only', () => {
    const m = getZipImportAuthorityModel({
      ...base,
      importMode: 'manifest',
      manifestPath: 'project.rbproj.json',
      ignoredFiles: ['foo.v', 'old.xdc'],
    });
    expect(m.isManifest).toBe(true);
    expect(m.tone).toBe('success');
    expect(m.title).toContain('authoritative');
    expect(m.classroom).toMatch(/RedByte read the embedded manifest/i);
    expect(m.facts.some((f) => f.text.includes('project.rbproj.json'))).toBe(true);
  });

  it('uses success tone for full runnable reconstructed imports', () => {
    const m = getZipImportAuthorityModel({ ...base, reconstructionLevel: 'full' });
    expect(m.tone).toBe('success');
    expect(m.classroom).toMatch(/gates and connections/i);
    expect(m.facts[0].text).toContain('top.vhd');
    expect(m.facts[1].text).toContain('board.xdc');
  });

  it('uses warn tone for ports-only reconstruction', () => {
    const m = getZipImportAuthorityModel({
      ...base,
      reconstructionLevel: 'ports-only',
    });
    expect(m.tone).toBe('warn');
    expect(m.classroom).toMatch(/port list/i);
  });

  it('uses error tone when compiler is blocked', () => {
    const m = getZipImportAuthorityModel({
      ...base,
      status: { ...base.status, compiler: 'blocked' },
      isImportRunnable: false,
    });
    expect(m.tone).toBe('error');
    expect(m.classroom).toMatch(/behavioral HDL|compile error/i);
  });
});
