import { describe, expect, it } from 'vitest';
import { buildExportHistoryViews, compareExportArtifacts, compareExportEntries } from '../exportHistoryModel';
import type { ProjectHealthExportResult } from '../projectHealth';

/** P2.5H Wave Three — two recorded packages compare file by file through their recorded digests. */
function entry(partial: Partial<ProjectHealthExportResult>): ProjectHealthExportResult {
  return { status: 'ok', ranAtIso: '2026-09-05T00:00:00.000Z', ...partial };
}

describe('exportHistoryModel — file-by-file comparison', () => {
  it('reports changed, same, added and removed files from the recorded digests', () => {
    const previous = entry({
      packageHash: 'p1',
      artifacts: ['top.vhd', 'top.xdc', 'old.md'],
      artifactHashes: { 'top.vhd': 'a', 'top.xdc': 'b', 'old.md': 'c' },
    });
    const current = entry({
      packageHash: 'p2',
      artifacts: ['top.vhd', 'top.xdc', 'testbench.vhd'],
      artifactHashes: { 'top.vhd': 'a', 'top.xdc': 'B', 'testbench.vhd': 'd' },
    });
    expect(compareExportArtifacts(previous, current)).toEqual([
      { path: 'top.vhd', state: 'same' },
      { path: 'top.xdc', state: 'changed' },
      { path: 'testbench.vhd', state: 'added' },
      { path: 'old.md', state: 'removed' },
    ]);
  });

  it('says so when a side recorded no digest for a file', () => {
    const previous = entry({ artifacts: ['top.vhd'] });
    const current = entry({ artifacts: ['top.vhd'], artifactHashes: { 'top.vhd': 'a' } });
    expect(compareExportArtifacts(previous, current)).toEqual([{ path: 'top.vhd', state: 'unknown' }]);
  });

  it('carries the file comparison on the entry comparison', () => {
    const views = buildExportHistoryViews([
      entry({ packageHash: 'p1', artifacts: ['top.vhd'], artifactHashes: { 'top.vhd': 'a' } }),
      entry({ packageHash: 'p2', artifacts: ['top.vhd'], artifactHashes: { 'top.vhd': 'z' } }),
    ]);
    const [current, previous] = views;
    const comparison = compareExportEntries(previous, current);
    expect(comparison.identical).toBe(false);
    expect(comparison.artifacts).toEqual([{ path: 'top.vhd', state: 'changed' }]);
  });
});
