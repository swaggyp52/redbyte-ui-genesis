// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { MismatchReport, RunProbe } from '../recording/runRecord';
import { buildMismatchEntries } from '../recording/runRecordUtils';

describe('mismatch forensics', () => {
  it('maps mismatch probes to detailed entries', () => {
    const mismatch: MismatchReport = {
      tick: 4,
      probeIds: ['p1'],
      expected: { p1: 1 },
      actual: { p1: 0 },
      recentStimulus: [],
    };
    const probes: RunProbe[] = [
      { id: 'p1', nodeId: 'n1', portName: 'out', label: 'Lamp out', color: '#00ffff' },
    ];
    const entries = buildMismatchEntries(mismatch, probes);
    expect(entries).toHaveLength(1);
    expect(entries[0].nodeId).toBe('n1');
    expect(entries[0].portName).toBe('out');
    expect(entries[0].expected).toBe(1);
    expect(entries[0].actual).toBe(0);
  });
});
