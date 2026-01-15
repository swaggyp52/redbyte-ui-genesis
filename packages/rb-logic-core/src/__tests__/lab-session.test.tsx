/**
 * Lab Session Store Tests
 * Verify: session creation, checkpoint tracking, autosave, restore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLabSessionStore,
  resetGlobalLabSessionStore,
  getGlobalLabSessionStore,
} from '../lab/sessionStore';
import {
  createEmptySession,
  createCheckpointResult,
  generateSessionId,
} from '../lab/LabSession';

describe('Lab Session Store', () => {
  // Mock localStorage
  let store: ReturnType<typeof createLabSessionStore>;

  beforeEach(() => {
    localStorage.clear();
    store = createLabSessionStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    resetGlobalLabSessionStore();
    vi.useRealTimers();
  });

  describe('Session Lifecycle', () => {
    it('should create a new session', () => {
      store.setState({ state: createEmptySession('lab-adder-101') });
      const state = store.getState().state;

      expect(state.labId).toBe('lab-adder-101');
      expect(state.sessionId).toBeTruthy();
      expect(state.createdAt).toBeGreaterThan(0);
      expect(state.updatedAt).toBe(state.createdAt);
    });

    it('should clear a session', () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      expect(store.getState().state.labId).toBe('lab-test');

      initial.clearSession();
      expect(store.getState().state.labId).toBe('');
    });

    it('should update timestamps on mutation', () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      const t1 = store.getState().state.updatedAt;

      vi.advanceTimersByTime(1000);
      initial.setCircuit('{"nodes": []}');
      const t2 = store.getState().state.updatedAt;

      expect(t2).toBeGreaterThan(t1);
    });
  });

  describe('Circuit Management', () => {
    it('should set and get circuit', () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      const circuit = '{"nodes": [], "connections": []}';

      initial.setCircuit(circuit);
      expect(initial.getCircuit()).toBe(circuit);
    });

    it('should start with empty circuit', () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      const circuit = initial.getCircuit();

      // Should be parseable JSON
      expect(() => JSON.parse(circuit)).not.toThrow();
    });
  });

  describe('Checkpoint Tracking', () => {
    it('should set and retrieve checkpoint results', () => {
      const initial = store.getState();
      initial.createSession('lab-test');

      const result = createCheckpointResult('cp1');
      result.status = 'passed';
      result.passedAt = Date.now();
      result.attempts = 1;
      result.feedback = 'Correct!';

      initial.setCheckpointResult('cp1', result);
      const retrieved = initial.getCheckpointResult('cp1');

      expect(retrieved).toEqual(result);
    });

    it('should track passed checkpoints', () => {
      const initial = store.getState();
      initial.createSession('lab-test');

      // Set total checkpoints
      store.getState().state.totalCheckpoints = 2;

      // Pass one
      const result1 = createCheckpointResult('cp1');
      result1.status = 'passed';
      initial.setCheckpointResult('cp1', result1);

      expect(initial.isCheckpointPassed('cp1')).toBe(true);
      expect(initial.isCheckpointPassed('cp2')).toBe(false);
    });

    it('should update checkpoint summary', () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      store.getState().state.totalCheckpoints = 3;

      // Pass 2 of 3
      const result1 = createCheckpointResult('cp1');
      result1.status = 'passed';
      initial.setCheckpointResult('cp1', result1);

      const result2 = createCheckpointResult('cp2');
      result2.status = 'passed';
      initial.setCheckpointResult('cp2', result2);

      const result3 = createCheckpointResult('cp3');
      result3.status = 'failed';
      initial.setCheckpointResult('cp3', result3);

      initial.updateCheckpointSummary();
      expect(store.getState().state.passedCheckpoints).toBe(2);
    });

    it('should get all checkpoint results', () => {
      const initial = store.getState();
      initial.createSession('lab-test');

      const r1 = createCheckpointResult('cp1');
      r1.status = 'passed';
      initial.setCheckpointResult('cp1', r1);

      const r2 = createCheckpointResult('cp2');
      r2.status = 'failed';
      initial.setCheckpointResult('cp2', r2);

      const all = initial.getAllCheckpointResults();
      expect(Object.keys(all)).toHaveLength(2);
      expect(all['cp1'].status).toBe('passed');
      expect(all['cp2'].status).toBe('failed');
    });
  });

  describe('Autosave to localStorage', () => {
    it('should save session to localStorage after delay', async () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      const sessionId = store.getState().state.sessionId;

      initial.setCircuit('{"test": "circuit"}');

      // Advance time to trigger autosave
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();

      const key = `redbyte.lab.session.${sessionId}`;
      const saved = localStorage.getItem(key);
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.labId).toBe('lab-test');
      expect(parsed.currentCircuit).toBe('{"test": "circuit"}');
    });

    it('should batch multiple changes into single save', async () => {
      const initial = store.getState();
      initial.createSession('lab-test');
      const sessionId = store.getState().state.sessionId;

      // Multiple rapid changes
      initial.setCircuit('circuit1');
      initial.setCircuit('circuit2');
      initial.setCircuit('circuit3');

      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();

      const key = `redbyte.lab.session.${sessionId}`;
      const saved = localStorage.getItem(key);
      const parsed = JSON.parse(saved!);

      // Should only save the final state
      expect(parsed.currentCircuit).toBe('circuit3');
    });

    it('should handle localStorage save errors gracefully', () => {
      const initial = store.getState();
      initial.createSession('lab-test');

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      initial.saveToLocalStorage();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save session'),
        expect.any(Error)
      );

      spy.mockRestore();
    });
  });

  describe('Restore from localStorage', () => {
    it('should load session from localStorage', () => {
      // Create and save
      const store1 = createLabSessionStore();
      store1.getState().createSession('lab-test');
      const sessionId = store1.getState().state.sessionId;
      store1.getState().setCircuit('{"saved": "circuit"}');
      store1.getState().saveToLocalStorage();

      // Create new store and load
      const store2 = createLabSessionStore();
      const loaded = store2.getState().loadFromLocalStorage(sessionId);

      expect(loaded).toBe(true);
      expect(store2.getState().state.labId).toBe('lab-test');
      expect(store2.getState().state.currentCircuit).toBe('{"saved": "circuit"}');
    });

    it('should return false for non-existent session', () => {
      const initial = store.getState();
      const loaded = initial.loadFromLocalStorage('non-existent-session');

      expect(loaded).toBe(false);
    });

    it('should restore checkpoint results', () => {
      // Create, add checkpoint, save
      const store1 = createLabSessionStore();
      store1.getState().createSession('lab-test');
      const sessionId = store1.getState().state.sessionId;

      const result = createCheckpointResult('cp1');
      result.status = 'passed';
      result.passedAt = 12345;
      store1.getState().setCheckpointResult('cp1', result);
      store1.getState().saveToLocalStorage();

      // Load in new store
      const store2 = createLabSessionStore();
      store2.getState().loadFromLocalStorage(sessionId);

      const restored = store2.getState().getCheckpointResult('cp1');
      expect(restored?.status).toBe('passed');
      expect(restored?.passedAt).toBe(12345);
    });

    it('should handle corrupted localStorage gracefully', () => {
      const sessionId = 'test-session-123';
      const key = `redbyte.lab.session.${sessionId}`;
      localStorage.setItem(key, 'invalid json {{{');

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const initial = store.getState();
      const loaded = initial.loadFromLocalStorage(sessionId);

      expect(loaded).toBe(false);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('Global Store Instance', () => {
    it('should return same instance on repeated calls', () => {
      resetGlobalLabSessionStore();

      const store1 = getGlobalLabSessionStore();
      const store2 = getGlobalLabSessionStore();

      expect(store1).toBe(store2);
    });

    it('should reset to new instance after reset', () => {
      const store1 = getGlobalLabSessionStore();
      resetGlobalLabSessionStore();
      const store2 = getGlobalLabSessionStore();

      expect(store1).not.toBe(store2);
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs', () => {
      const id1 = generateSessionId('lab-test');
      const id2 = generateSessionId('lab-test');

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^lab-test-\d+-[a-z0-9]+$/);
    });

    it('should use provided timestamp', () => {
      const timestamp = 1609459200000; // 2021-01-01
      const id = generateSessionId('lab-test', timestamp);

      expect(id).toContain('1609459200000');
    });
  });

  describe('Empty Session Creation', () => {
    it('should create empty session with defaults', () => {
      const session = createEmptySession('lab-test');

      expect(session.labId).toBe('lab-test');
      expect(session.sessionId).toBeTruthy();
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.studentName).toBeUndefined();
      expect(JSON.parse(session.currentCircuit)).toEqual({
        nodes: [],
        connections: [],
      });
      expect(session.checkpointResults).toEqual({});
      expect(session.totalCheckpoints).toBe(0);
      expect(session.passedCheckpoints).toBe(0);
    });

    it('should accept provided session ID', () => {
      const customId = 'custom-session-123';
      const session = createEmptySession('lab-test', customId);

      expect(session.sessionId).toBe(customId);
    });
  });

  describe('Checkpoint Result Creation', () => {
    it('should create result with defaults', () => {
      const result = createCheckpointResult('cp-1');

      expect(result.checkpointId).toBe('cp-1');
      expect(result.status).toBe('not-attempted');
      expect(result.attempts).toBe(0);
      expect(result.feedback).toBe('');
      expect(result.passedAt).toBeUndefined();
    });
  });

  describe('Full Workflow', () => {
    it('should handle complete student session', () => {
      const initial = store.getState();

      // 1. Create session
      initial.createSession('lab-adder-101');
      expect(store.getState().state.labId).toBe('lab-adder-101');

      // 2. Load lab definition (3 checkpoints)
      store.getState().state.totalCheckpoints = 3;

      // 3. Student builds circuit
      initial.setCircuit('{"nodes": [{"id": "and1", "type": "AND"}]}');

      // 4. First checkpoint: fails
      const cp1 = createCheckpointResult('cp1');
      cp1.status = 'failed';
      cp1.attempts = 1;
      cp1.feedback = 'Need 1 more OR gate';
      initial.setCheckpointResult('cp1', cp1);

      // 5. Student modifies circuit
      initial.setCircuit('{"nodes": [{"id": "and1", "type": "AND"}, {"id": "or1", "type": "OR"}]}');

      // 6. First checkpoint: passes
      cp1.status = 'passed';
      cp1.passedAt = Date.now();
      cp1.attempts = 2;
      cp1.feedback = 'Correct!';
      initial.setCheckpointResult('cp1', cp1);

      // 7. Other checkpoints still fail
      const cp2 = createCheckpointResult('cp2');
      cp2.status = 'failed';
      cp2.attempts = 1;
      initial.setCheckpointResult('cp2', cp2);

      const cp3 = createCheckpointResult('cp3');
      cp3.status = 'not-attempted';
      initial.setCheckpointResult('cp3', cp3);

      // Verify state
      initial.updateCheckpointSummary();
      expect(store.getState().state.passedCheckpoints).toBe(1);
      expect(store.getState().state.currentCircuit).toContain('or1');
      expect(initial.isCheckpointPassed('cp1')).toBe(true);
      expect(initial.isCheckpointPassed('cp2')).toBe(false);
    });
  });
});
