import { describe, expect, it } from 'vitest';
import {
  buildVivadoDigitalTwin,
  normalizeVivadoDigitalTwin,
  serializeVivadoDigitalTwin,
  validateVivadoDigitalTwin,
  vivadoSnapshotEvidenceLabel,
  VIVADO_DIGITAL_TWIN_SCHEMA_VERSION,
} from '../vivadoDigitalTwin';

const INPUT = {
  part: 'xc7a35tcpg236-1',
  topModule: 'student_top',
  toolVersion: 'Vivado 2024.2',
  generatedAtIso: '2026-03-09T00:00:00.000Z',
  utilization: { lut: 12, ff: 8, io: 5 },
  timing: { wns: 1.2, tns: 0, met: true },
  artifacts: [
    { path: 'reports/timing.rpt', sha256: 'a'.repeat(64), bytes: 100 },
    { path: 'checkpoints/impl.dcp', sha256: 'b'.repeat(64), bytes: 2048 },
  ],
  notes: ['implemented externally'],
};

describe('buildVivadoDigitalTwin', () => {
  it('is always tagged external and carries the versioned envelope', () => {
    const snap = buildVivadoDigitalTwin(INPUT);
    expect(snap.generatedBy).toBe('external');
    expect(snap.schemaVersion).toBe(VIVADO_DIGITAL_TWIN_SCHEMA_VERSION);
    expect(snap.part).toBe('xc7a35tcpg236-1');
    expect(snap.timing).toEqual({ wns: 1.2, tns: 0, met: true });
  });

  it('sorts artifacts by path and dedups', () => {
    const snap = buildVivadoDigitalTwin({
      ...INPUT,
      artifacts: [
        { path: 'z.rpt', sha256: 'c'.repeat(64), bytes: 1 },
        { path: 'a.rpt', sha256: 'd'.repeat(64), bytes: 2 },
        { path: 'a.rpt', sha256: 'e'.repeat(64), bytes: 3 },
      ],
    });
    expect(snap.artifacts.map((a) => a.path)).toEqual(['a.rpt', 'z.rpt']);
  });

  it('omits absent optional fields', () => {
    const snap = buildVivadoDigitalTwin({ part: 'p', topModule: 't', toolVersion: 'v' });
    expect(snap.utilization).toBeUndefined();
    expect(snap.timing).toBeUndefined();
    expect(snap.generatedAtIso).toBeUndefined();
    expect(snap.notes).toBeUndefined();
    expect(snap.artifacts).toEqual([]);
  });
});

describe('determinism', () => {
  it('serializes byte-identically regardless of input field order', () => {
    const a = serializeVivadoDigitalTwin(buildVivadoDigitalTwin(INPUT));
    const reordered = { toolVersion: INPUT.toolVersion, part: INPUT.part, topModule: INPUT.topModule, timing: INPUT.timing, utilization: INPUT.utilization, artifacts: [...INPUT.artifacts].reverse(), notes: INPUT.notes, generatedAtIso: INPUT.generatedAtIso };
    const b = serializeVivadoDigitalTwin(buildVivadoDigitalTwin(reordered));
    expect(a).toBe(b);
  });

  it('round-trips through normalize', () => {
    const snap = buildVivadoDigitalTwin(INPUT);
    const serialized = serializeVivadoDigitalTwin(snap);
    const restored = normalizeVivadoDigitalTwin(JSON.parse(serialized));
    expect(serializeVivadoDigitalTwin(restored)).toBe(serialized);
  });
});

describe('validation + honesty', () => {
  it('accepts a complete snapshot and flags a bad hash / missing fields', () => {
    expect(validateVivadoDigitalTwin(buildVivadoDigitalTwin(INPUT)).ok).toBe(true);
    const bad = buildVivadoDigitalTwin({ part: '', topModule: '', toolVersion: '', artifacts: [{ path: 'x', sha256: 'nothex', bytes: 1 }] });
    const result = validateVivadoDigitalTwin(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('always labels evidence as generated outside RedByte', () => {
    const label = vivadoSnapshotEvidenceLabel(buildVivadoDigitalTwin(INPUT));
    expect(label).toContain('outside RedByte');
    expect(label).toContain('no in-browser synthesis');
  });
});
