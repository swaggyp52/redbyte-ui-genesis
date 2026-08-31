import { describe, expect, it } from 'vitest';
import type { ProjectHealthExportResult } from '../projectHealth';
import {
  buildExportHistoryViews,
  compareExportEntries,
  shortHash,
} from '../exportHistoryModel';

function ex(partial: Partial<ProjectHealthExportResult>): ProjectHealthExportResult {
  return { status: 'ok', ...partial };
}

describe('exportHistoryModel', () => {
  it('builds newest-first views with ordinals and provenance', () => {
    const views = buildExportHistoryViews([
      ex({ downloadKind: 'project', packageHash: 'aaa', verificationTrust: 'draft', ranAtIso: '2026-08-30T00:00:00Z' }),
      ex({ downloadKind: 'kit', packageHash: 'bbb', verificationTrust: 'trusted', downloadedAtIso: '2026-08-30T01:00:00Z' }),
    ]);
    expect(views).toHaveLength(2);
    // Newest first.
    expect(views[0].ordinal).toBe(2);
    expect(views[0].kind).toBe('kit');
    expect(views[0].trust).toBe('trusted');
    expect(views[0].packageHash).toBe('bbb');
    expect(views[1].ordinal).toBe(1);
    expect(views[1].kind).toBe('project');
  });

  it('marks two identical packages as identical', () => {
    const views = buildExportHistoryViews([
      ex({ packageHash: 'aaa', bundleHash: 'x', manifestHash: 'm' }),
      ex({ packageHash: 'aaa', bundleHash: 'x', manifestHash: 'm' }),
    ]);
    const cmp = compareExportEntries(views[1], views[0]);
    expect(cmp.identical).toBe(true);
    expect(cmp.changes).toHaveLength(0);
  });

  it('reports which content hashes changed between two packages', () => {
    const views = buildExportHistoryViews([
      ex({ packageHash: 'aaa', bundleHash: 'b1', manifestHash: 'm1', sourceHashes: { export: 's1' } }),
      ex({ packageHash: 'bbb', bundleHash: 'b1', manifestHash: 'm2', sourceHashes: { export: 's1' } }),
    ]);
    const cmp = compareExportEntries(views[1], views[0]);
    expect(cmp.identical).toBe(false);
    const fields = cmp.changes.map((c) => c.field).sort();
    expect(fields).toEqual(['manifest', 'package']);
    const pkg = cmp.changes.find((c) => c.field === 'package');
    expect(pkg?.from).toBe('aaa');
    expect(pkg?.to).toBe('bbb');
  });

  it('uses sourceHashes.export or the top-level hash for the source fingerprint', () => {
    const views = buildExportHistoryViews([ex({ hash: 'legacy' }), ex({ sourceHashes: { export: 'modern' } })]);
    expect(views[0].sourceHash).toBe('modern');
    expect(views[1].sourceHash).toBe('legacy');
  });

  it('shortens hashes for display', () => {
    expect(shortHash('0123456789abcdef0123')).toBe('0123456789ab');
    expect(shortHash(undefined)).toBe('—');
  });
});
