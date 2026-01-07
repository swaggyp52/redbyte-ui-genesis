// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { buildDebugOverlayFromSignals } from '../recording/runRecordUtils';

describe('debug overlay', () => {
  it('builds overlay values from signal map', () => {
    const signals = new Map<string, 0 | 1>([
      ['a.out', 1],
      ['b.in', 0],
    ]);
    const overlay = buildDebugOverlayFromSignals(signals, 10, 5);
    expect(overlay.enabled).toBe(true);
    expect(overlay.tick).toBe(10);
    expect(overlay.timeSec).toBe(2);
    expect(overlay.signals.a.out).toBe(1);
    expect(overlay.signals.b.in).toBe(0);
    expect(overlay.portKeySignals?.['a:out']).toBe(1);
  });
});
