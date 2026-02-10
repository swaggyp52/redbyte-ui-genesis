import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock related modules
vi.mock('../use-auto-save');
vi.mock('../store/persistence');

import type { SerializedSnapshot } from '../store/labStore';

describe('Recovery Banner Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('snapshot validation accepts valid structure', () => {
    const { validateSnapshotV1 } = require('../store/labStore');
    
    const validSnapshot: SerializedSnapshot = {
      schemaVersion: 1,
      sessionId: 'test-123',
      savedAt: new Date().toISOString(),
      doc: {
        schemaVersion: 1,
        meta: {
          id: 'doc-1',
          name: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        truthTable: Array(16).fill(null).map((_, i) => ({
          b3: (i >> 3) & 1,
          b2: (i >> 2) & 1,
          b1: (i >> 1) & 1,
          b0: i & 1,
          seg: [1, 1, 1, 1, 1, 1, 1] as [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1],
          isDontCare: false,
        })),
        kMaps: {},
        expressions: {},
        results: {},
      },
      windows: [],
      events: [],
      eventSeq: 0,
    };
    
    expect(validateSnapshotV1(validSnapshot)).toBe(true);
  });

  it('snapshot validation rejects invalid schemaVersion', () => {
    const { validateSnapshotV1 } = require('../store/labStore');
    
    const invalidSnapshot = {
      schemaVersion: 99,
      sessionId: 'test-123',
      doc: {},
      windows: [],
      events: [],
      eventSeq: 0,
    };
    
    expect(validateSnapshotV1(invalidSnapshot)).toBe(false);
  });

  it('snapshot validation rejects missing doc', () => {
    const { validateSnapshotV1 } = require('../store/labStore');
    
    const invalidSnapshot = {
      schemaVersion: 1,
      sessionId: 'test-123',
      windows: [],
      events: [],
      eventSeq: 0,
    };
    
    expect(validateSnapshotV1(invalidSnapshot)).toBe(false);
  });
});
