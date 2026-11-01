// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { parseVcd } from '../vcdImport';
import { waveformFromVcd } from '../simulationProvider';
import { DEFAULT_VCD_ANALYZER_CONFIG } from '../vcdAnalyzer';

const rt = () => useProjectRuntime.getState();

const VCD = [
  '$timescale 1ns $end',
  '$var wire 1 ! clk $end',
  '$var wire 4 # data $end',
  '$enddefinitions $end',
  '#0',
  '0!',
  'b0000 #',
  '#5',
  '1!',
  'b1010 #',
].join('\n');

const waveform = () => waveformFromVcd(parseVcd(VCD), 'run.vcd');

function persistedCandidate(extra: Record<string, unknown>) {
  const current = rt();
  return {
    projectId: 'rb-vcd-test',
    projectName: 'VCD Test',
    projectDescription: '',
    lastSavedAt: 'Autosaved',
    activeExampleId: null,
    projectIoRows: [],
    projectVectors: [],
    customVectors: [],
    circuit: { nodes: [], connections: [] },
    verifyRunHistory: [],
    sim: current.sim,
    projectHealthCore: current.projectHealthCore,
    ...extra,
  } as never;
}

describe('projectRuntime imported-waveform authority', () => {
  beforeEach(() => {
    rt().resetToActiveExample();
  });

  it('starts empty', () => {
    expect(rt().importedWaveform).toBeNull();
    expect(rt().vcdAnalyzer).toEqual(DEFAULT_VCD_ANALYZER_CONFIG);
  });

  it('setImportedWaveform stores the evidence and resets the analyzer view', () => {
    rt().setVcdAnalyzerConfig({ cursorTime: 5, selectedKeys: ['#'] });
    expect(rt().vcdAnalyzer.cursorTime).toBe(5);
    rt().setImportedWaveform(waveform());
    expect(rt().importedWaveform?.signals.map((s) => s.name)).toEqual(['clk', 'data']);
    // The provider tier is the honest imported-external one.
    expect(rt().importedWaveform?.provider.evidenceTier).toBe('imported-external');
    // A fresh waveform resets stale selection/cursor.
    expect(rt().vcdAnalyzer).toEqual(DEFAULT_VCD_ANALYZER_CONFIG);
  });

  it('setVcdAnalyzerConfig patches and normalizes the view config', () => {
    rt().setVcdAnalyzerConfig({ cursorTime: 3.9, search: 'clk' });
    expect(rt().vcdAnalyzer.cursorTime).toBe(3);
    expect(rt().vcdAnalyzer.search).toBe('clk');
    rt().setVcdAnalyzerConfig({ selectedKeys: ['#', '#'] });
    expect(rt().vcdAnalyzer.selectedKeys).toEqual(['#']);
    // Prior patch preserved.
    expect(rt().vcdAnalyzer.search).toBe('clk');
  });

  it('setImportedWaveform(null) clears the evidence', () => {
    rt().setImportedWaveform(waveform());
    rt().setImportedWaveform(null);
    expect(rt().importedWaveform).toBeNull();
  });

  it('loading a project clears prior imported evidence', () => {
    rt().setImportedWaveform(waveform());
    rt().loadFromProject({
      kind: 'rb-project',
      version: 1,
      name: 'Fresh',
      createdAt: '2026-03-09T00:00:00.000Z',
      updatedAt: '2026-03-09T00:00:00.000Z',
      circuit: { nodes: [], connections: [] },
    } as never);
    expect(rt().importedWaveform).toBeNull();
    expect(rt().vcdAnalyzer).toEqual(DEFAULT_VCD_ANALYZER_CONFIG);
  });

  it('persists and restores the imported waveform + analyzer config across reload', () => {
    const merged = mergePersistedRuntimeState(
      persistedCandidate({
        importedWaveform: waveform(),
        vcdAnalyzer: { selectedKeys: ['#'], radixByKey: { '#': 'dec' }, cursorTime: 5, search: '' },
      }),
      rt(),
    );
    expect(merged.importedWaveform?.signals.map((s) => s.name)).toEqual(['clk', 'data']);
    expect(merged.vcdAnalyzer.selectedKeys).toEqual(['#']);
    expect(merged.vcdAnalyzer.radixByKey['#']).toBe('dec');
    expect(merged.vcdAnalyzer.cursorTime).toBe(5);
  });

  it('defaults imported waveform to null when none is persisted', () => {
    const merged = mergePersistedRuntimeState(persistedCandidate({}), rt());
    expect(merged.importedWaveform).toBeNull();
    expect(merged.vcdAnalyzer).toEqual(DEFAULT_VCD_ANALYZER_CONFIG);
  });
});
