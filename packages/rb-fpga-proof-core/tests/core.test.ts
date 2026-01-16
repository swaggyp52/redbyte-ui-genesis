import { describe, it, expect } from 'vitest';
import {
  parseCapsule,
  loadEventsNdjson,
  verifyHashes,
  normalizeEvent,
  diffCapsules,
  computeVectorVerdicts,
  buildTimelineRows,
  summarizeCapsule,
} from '../src/index';
import type { Capsule, ProofEvent, VectorResult } from '../src/types';

const mockCapsule: Capsule = {
  session_id: 'test-session-1',
  vectors: [
    { id: 'v1', name: 'Vector 1', pass: true },
    { id: 'v2', name: 'Vector 2', pass: true },
    { id: 'v3', name: 'Vector 3', pass: false },
  ],
  summary: { total: 3, pass: 2, fail: 1 },
};

const mockEvents: ProofEvent[] = [
  { tick: 0, seq: 0, signal: 'clk', old: 0, new: 1 },
  { tick: 1, seq: 1, signal: 'data', old: 0, new: 1 },
  { tick: 2, seq: 2, signal: 'clk', old: 1, new: 0 },
];

describe('rb-fpga-proof-core', () => {
  describe('parseCapsule', () => {
    it('should parse valid capsule JSON string', () => {
      const json = JSON.stringify(mockCapsule);
      const result = parseCapsule(json);
      expect(result.session_id).toBe('test-session-1');
      expect(result.vectors.length).toBe(3);
    });

    it('should parse capsule object directly', () => {
      const result = parseCapsule(mockCapsule);
      expect(result.session_id).toBe('test-session-1');
    });

    it('should support test_summary (dual schema)', () => {
      const capsule = { ...mockCapsule };
      delete (capsule as Record<string, unknown>).summary;
      (capsule as Record<string, unknown>).test_summary = { total: 3, pass: 2, fail: 1 };

      const result = parseCapsule(capsule);
      expect(result.session_id).toBe('test-session-1');
    });

    it('should reject invalid JSON', () => {
      expect(() => parseCapsule('{ invalid json }')).toThrow('Invalid capsule JSON');
    });

    it('should reject missing session_id', () => {
      const bad = { vectors: [] };
      expect(() => parseCapsule(bad)).toThrow('session_id');
    });
  });

  describe('loadEventsNdjson', () => {
    it('should parse valid NDJSON', () => {
      const ndjson = mockEvents.map((e) => JSON.stringify(e)).join('\n');
      const result = loadEventsNdjson(ndjson);
      expect(result.length).toBe(3);
      expect(result[0].signal).toBe('clk');
    });

    it('should handle empty string', () => {
      const result = loadEventsNdjson('');
      expect(result.length).toBe(0);
    });

    it('should skip malformed lines', () => {
      const ndjson = `${JSON.stringify(mockEvents[0])}\n{ bad }\n${JSON.stringify(mockEvents[1])}`;
      const result = loadEventsNdjson(ndjson);
      expect(result.length).toBe(2);
    });
  });

  describe('verifyHashes', () => {
    it('should pass valid capsule', () => {
      const result = verifyHashes(mockCapsule, '');
      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should fail missing session_id', () => {
      const bad: Capsule = { ...mockCapsule, session_id: '' };
      const result = verifyHashes(bad, '');
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it('strict mode should error on empty events', () => {
      const result = verifyHashes(mockCapsule, '', true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.exitCode).toBe(2);
    });
  });

  describe('normalizeEvent', () => {
    it('should add seq if missing', () => {
      const event: ProofEvent = { tick: 0, signal: 'clk', old: 0, new: 1 };
      const result = normalizeEvent(event, 5);
      expect(result.seq).toBe(5);
    });

    it('should preserve existing seq', () => {
      const event: ProofEvent = { tick: 0, seq: 99, signal: 'clk', old: 0, new: 1 };
      const result = normalizeEvent(event, 5);
      expect(result.seq).toBe(99);
    });
  });

  describe('diffCapsules', () => {
    it('should return MATCH for identical capsules', () => {
      const result = diffCapsules(mockCapsule, mockCapsule, mockEvents, mockEvents);
      expect(result.verdict).toBe('MATCH');
      expect(result.exitCode).toBe(0);
    });

    it('should return DIVERGED for different vector count', () => {
      const other: Capsule = {
        ...mockCapsule,
        vectors: [...mockCapsule.vectors, { id: 'v4', pass: true }],
      };
      const result = diffCapsules(mockCapsule, other, [], []);
      expect(result.verdict).toBe('DIVERGED');
      expect(result.exitCode).toBe(1);
    });

    it('should return DIVERGED for different vector verdict', () => {
      const other: Capsule = {
        ...mockCapsule,
        vectors: mockCapsule.vectors.map((v, i) => (i === 0 ? { ...v, pass: false } : v)),
      };
      const result = diffCapsules(mockCapsule, other, [], []);
      expect(result.verdict).toBe('DIVERGED');
      expect(result.exitCode).toBe(1);
    });

    it('strict mode should return INVALID for event count mismatch', () => {
      const result = diffCapsules(mockCapsule, mockCapsule, mockEvents, [], true);
      expect(result.verdict).toBe('INVALID');
      expect(result.exitCode).toBe(2);
      expect(result.hashMismatch).toBe(true);
    });

    it('lenient mode should return DIVERGED for event count mismatch', () => {
      const result = diffCapsules(mockCapsule, mockCapsule, mockEvents, [], false);
      expect(result.verdict).toBe('DIVERGED');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('computeVectorVerdicts', () => {
    it('should map vectors to VectorRow format', () => {
      const result = computeVectorVerdicts(mockCapsule);
      expect(result.length).toBe(3);
      expect(result[0].status).toBe('PASS');
      expect(result[2].status).toBe('FAIL');
    });
  });

  describe('buildTimelineRows', () => {
    it('should group events by tick', () => {
      const result = buildTimelineRows(mockEvents);
      expect(result.length).toBe(3);
      expect(result[0].tick).toBe(0);
      expect(result[0].changes[0].signal).toBe('clk');
    });

    it('should handle empty events', () => {
      const result = buildTimelineRows([]);
      expect(result.length).toBe(0);
    });
  });

  describe('summarizeCapsule', () => {
    it('should return explicit summary if present', () => {
      const result = summarizeCapsule(mockCapsule);
      expect(result.total).toBe(3);
      expect(result.pass).toBe(2);
      expect(result.fail).toBe(1);
    });

    it('should compute summary from vectors if missing', () => {
      const capsule: Capsule = { ...mockCapsule };
      delete (capsule as Record<string, unknown>).summary;
      const result = summarizeCapsule(capsule);
      expect(result.total).toBe(3);
      expect(result.pass).toBe(2);
    });
  });
});
