import { describe, expect, it } from 'vitest';
import {
  buildFieldSignalResolver,
  normalizeSignalId,
} from '../signalIdentity';
import type {
  VerifyEvidenceIoRow,
  VerifyEvidenceResolutionEntry,
} from '../verifyReport';

function ioRow(
  id: string,
  direction: 'in' | 'out',
  nodeId?: string,
  label = id
): VerifyEvidenceIoRow {
  return { id, label, direction, nodeId };
}

function entry(
  role: VerifyEvidenceResolutionEntry['role'],
  rawKey: string,
  matchedSignal: string | null
): VerifyEvidenceResolutionEntry {
  return { role, rawKey, normalizedKey: normalizeSignalId(rawKey), matchedSignal };
}

describe('normalizeSignalId', () => {
  it('lowercases, maps ":" to ".", and collapses non-word chars to "_"', () => {
    expect(normalizeSignalId('LD0')).toBe('ld0');
    expect(normalizeSignalId('u0/ld0')).toBe('u0_ld0');
    expect(normalizeSignalId('ld0[0]')).toBe('ld0_0_');
    expect(normalizeSignalId('ld0_node:in')).toBe('ld0_node_in');
  });
});

describe('buildFieldSignalResolver — the Full Adder ground truth', () => {
  const evidence = {
    ioRows: [
      ioRow('ld0', 'out', 'ld0_node', 'LD0 (CARRY)'),
      ioRow('ld1', 'out', 'ld1_node', 'LD1 (SUM)'),
      ioRow('sw0', 'in', 'sw0_node'),
    ],
    normalizationMap: [
      entry('expected', 'ld0', 'ld0carry'),
      entry('output', 'ld0carry', 'ld0_node.in'),
      entry('expected', 'ld1', 'ld1sum'),
      entry('output', 'ld1sum', 'ld1_node.in'),
    ],
  };
  const reportSignals = ['ld0carry', 'ld1sum'];

  it('resolves each output field to its canonical run signal via evidence, not containment', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['ld0', 'ld1'],
      evidence,
      reportSignals,
    });
    const ld0 = resolver.resolve('ld0');
    expect(ld0.runSignal).toBe('ld0carry');
    expect(ld0.kind).toBe('evidence-expected');
    expect(ld0.nodeId).toBe('ld0_node');

    const ld1 = resolver.resolve('ld1');
    expect(ld1.runSignal).toBe('ld1sum');
    expect(ld1.kind).toBe('evidence-expected');
    expect(resolver.ambiguous).toEqual([]);
  });

  it('falls back to the node .in/.out port when there is no expected entry', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['ld0'],
      evidence: {
        ioRows: [ioRow('ld0', 'out', 'ld0_node', 'LD0 (CARRY)')],
        normalizationMap: [entry('output', 'ld0carry', 'ld0_node.in')],
      },
      reportSignals: ['ld0carry'],
    });
    const ld0 = resolver.resolve('ld0');
    expect(ld0.runSignal).toBe('ld0carry');
    expect(ld0.kind).toBe('evidence-node');
  });
});

describe('buildFieldSignalResolver — containment traps (the reason this exists)', () => {
  it('does NOT match ld0 to ld0carry / ld0carry2 by prefix when evidence says ld0 == ld0', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['ld0'],
      evidence: { normalizationMap: [entry('expected', 'ld0', 'ld0')] },
      reportSignals: ['ld0', 'ld0carry', 'ld0carry2'],
    });
    const ld0 = resolver.resolve('ld0');
    // Containment would have collided with all three; identity picks exactly ld0.
    expect(ld0.runSignal).toBe('ld0');
    expect(ld0.kind).toBe('exact');
  });

  it('keeps ld0 and ld0carry as distinct fields, each to its own signal', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['ld0', 'ld0carry'],
      evidence: {
        normalizationMap: [
          entry('expected', 'ld0', 'ld0'),
          entry('expected', 'ld0carry', 'ld0carry'),
        ],
      },
      reportSignals: ['ld0', 'ld0carry'],
    });
    expect(resolver.resolve('ld0').runSignal).toBe('ld0');
    expect(resolver.resolve('ld0carry').runSignal).toBe('ld0carry');
    expect(resolver.ambiguous).toEqual([]);
  });
});

describe('buildFieldSignalResolver — hierarchy is preserved', () => {
  it('does not confuse a hierarchical path with its leaf name', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['u0/ld0', 'ld0'],
      evidence: {
        normalizationMap: [
          entry('expected', 'u0/ld0', 'u0_ld0_sig'),
          entry('expected', 'ld0', 'ld0_sig'),
        ],
      },
      reportSignals: ['u0_ld0_sig', 'ld0_sig'],
    });
    expect(resolver.resolve('u0/ld0').runSignal).toBe('u0_ld0_sig');
    expect(resolver.resolve('ld0').runSignal).toBe('ld0_sig');
  });
});

describe('buildFieldSignalResolver — ambiguity is surfaced, never guessed', () => {
  it('marks a field ambiguous when the evidence offers two distinct signals', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['q'],
      evidence: {
        normalizationMap: [
          entry('expected', 'q', 'q_a'),
          entry('expected', 'q', 'q_b'),
        ],
      },
      reportSignals: ['q_a', 'q_b'],
    });
    const q = resolver.resolve('q');
    expect(q.runSignal).toBeNull();
    expect(q.kind).toBe('ambiguous');
    expect([...q.candidates].sort()).toEqual(['q_a', 'q_b']);
    expect(resolver.ambiguous).toEqual(['q']);
  });

  it('demotes both fields to ambiguous when they collide on one run signal', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['a', 'b'],
      evidence: {
        normalizationMap: [
          entry('expected', 'a', 'shared'),
          entry('expected', 'b', 'shared'),
        ],
      },
      reportSignals: ['shared'],
    });
    expect(resolver.resolve('a').kind).toBe('ambiguous');
    expect(resolver.resolve('b').kind).toBe('ambiguous');
    expect(resolver.resolve('a').runSignal).toBeNull();
    expect([...resolver.ambiguous].sort()).toEqual(['a', 'b']);
  });

  it('ignores evidence candidates that are absent from the report set', () => {
    const resolver = buildFieldSignalResolver({
      fieldIds: ['ld0'],
      evidence: { normalizationMap: [entry('expected', 'ld0', 'ghost_signal')] },
      reportSignals: ['ld0carry'],
    });
    // ghost_signal is not in the report → unresolved, not a false positive.
    expect(resolver.resolve('ld0').kind).toBe('unresolved');
    expect(resolver.resolve('ld0').runSignal).toBeNull();
  });

  it('resolves an unknown field to unresolved rather than throwing', () => {
    const resolver = buildFieldSignalResolver({ fieldIds: [], evidence: {}, reportSignals: [] });
    expect(resolver.resolve('nope').kind).toBe('unresolved');
  });
});
